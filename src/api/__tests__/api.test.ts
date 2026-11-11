// Imports
// -----------------------------------------------------------------------------
// Node.js
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// External
import { afterEach, describe, expect, test, vi } from 'vitest'

// Internal
import { PannonicoError } from '../pannonico-error.js'

// Types
import type { BuildOptions } from '../types.js'

// Constants
// -----------------------------------------------------------------------------
const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const FIXTURES: string[] = []
// The fixture replaces only a disposable CLI entrypoint. Production has no
// executable override, and all public API modules run from actual built bytes.
const CLI_FIXTURE = `
if (process.env.API_TEST_ECHO === '1') {
  process.stdin.pipe(process.stdout);
} else {
  process.stdout.write(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),value:process.env.API_TEST_VALUE}));
  process.stderr.write('fixture diagnostic');
  process.exitCode=Number(process.env.API_TEST_EXIT ?? 0);
}
`

// Functions
// -----------------------------------------------------------------------------
/** Build an isolated installed-layout fixture so tests cannot select a production executable. */
const fixture = async (program = CLI_FIXTURE) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pannonico-api-'))
  FIXTURES.push(root)
  await mkdir(path.join(root, 'dist'), { recursive: true })
  await cp(
    path.join(PACKAGE_ROOT, 'dist', 'js'),
    path.join(root, 'dist', 'js'),
    { recursive: true },
  )
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ type: 'module' }),
  )
  await writeFile(path.join(root, 'dist', 'js', 'bin', 'pannonico.js'), program)
  const url = pathToFileURL(path.join(root, 'dist', 'js', 'index.js')).href
  const api = (await import(
    /* @vite-ignore */ url
  )) as typeof import('../../index.js')
  return { root, api, url }
}

// Tests
// -----------------------------------------------------------------------------
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(
    FIXTURES.splice(0).map(root => rm(root, { recursive: true, force: true })),
  )
})

describe('Expect the binary API to preserve CLI arguments', () => {
  test('when all build flags and a dash-prefixed page are supplied', async () => {
    const { root, api } = await fixture()
    const options: BuildOptions = {
      root: '--page č.html',
      config: '--help',
      pages: 'a b',
      layouts: '',
      partials: 'partials',
      data: 'input-data',
      dataUrls: ['https://example.test/a,b', 'https://example.test/b'],
      out: 'output',
      defaultLayout: 'default',
      defaultLanguage: 'sr',
      htmlValidation: 'warn',
      maxOutputWorkers: 0,
      jobs: 4,
      dryRun: true,
      reportJson: 'report.json',
      quiet: false,
      verbose: true,
      noColor: true,
      beautify: false,
      minify: false,
      help: false,
    }
    const result = await api.build(options, { cwd: root })
    expect(JSON.parse(result.stdout)).toEqual({
      cwd: root,
      args: [
        'build',
        '--config=--help',
        '--pages=a b',
        '--layouts=',
        '--partials=partials',
        '--data=input-data',
        '--data-url=https://example.test/a,b',
        '--data-url=https://example.test/b',
        '--out=output',
        '--default-layout=default',
        '--default-language=sr',
        '--html-validation=warn',
        '--max-output-workers=0',
        '--jobs=4',
        '--dry-run=true',
        '--report-json=report.json',
        '--quiet=false',
        '--verbose=true',
        '--no-color=true',
        '--beautify=false',
        '--minify=false',
        '--help=false',
        path.join(root, '--page č.html'),
      ],
    })
    expect(result.stderr).toBe('fixture diagnostic')
    expect(result.exitCode).toBe(0)
  })

  test('when watch receives its server and report options', async () => {
    const { root, api } = await fixture(
      `await import('node:fs/promises').then(fs => fs.writeFile(process.env.API_TEST_ARGUMENT_FILE, JSON.stringify(process.argv.slice(2))));`,
    )
    const file = path.join(root, 'arguments.json')
    const session = api.watch(
      {
        root: 'site',
        host: 'localhost',
        port: 0,
        open: false,
        reportJson: 'watch.json',
      },
      { cwd: root, env: { API_TEST_ARGUMENT_FILE: file } },
    )
    await session.completed
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([
      'watch',
      '--report-json=watch.json',
      '--host=localhost',
      '--port=0',
      '--open=false',
      path.join(root, 'site'),
    ])
    expect(session.child.stdin).toBeNull()
  })

  test('when options are omitted or explicitly empty', async () => {
    const { api } = await fixture()
    expect(JSON.parse((await api.build({ dataUrls: [] })).stdout).args).toEqual(
      ['build'],
    )
    expect(JSON.parse((await api.build({ root: '' })).stdout).args).toEqual([
      'build',
      '',
    ])
  })

  test('when scaffold, manual, signing, and informational commands are called', async () => {
    const { api } = await fixture()
    const cases: [Promise<{ stdout: string }>, string[]][] = [
      [
        api.scaffold({
          empty: false,
          min: true,
          vite: false,
          withDocs: true,
          force: true,
          help: true,
        }),
        [
          'scaffold',
          '--empty=false',
          '--min=true',
          '--vite=false',
          '--with-docs=true',
          '--force=true',
          '--help=true',
        ],
      ],
      [
        api.manual({ eject: true, help: false }),
        ['manual', '--eject=true', '--help=false'],
      ],
      [
        api.signingDns({ config: '--help', help: true }),
        ['signing-dns', '--config', '--help', '--help'],
      ],
      [api.capabilities({ help: true }), ['capabilities', '--help']],
      [api.version(), ['--version']],
      [api.help('build'), ['help', 'build']],
      [api.help(), ['help']],
    ]
    for (const [pending, args] of cases)
      expect(JSON.parse((await pending).stdout).args).toEqual(args)
  })
})

describe('Expect command lifetimes to preserve caller state', () => {
  test('when concurrent calls overlay and remove environment values', async () => {
    const { api, root } = await fixture()
    vi.stubEnv('API_TEST_VALUE', 'parent')
    const cwd = process.cwd()
    const environment = { ...process.env }
    const exitCode = process.exitCode
    const listeners = process.listeners('SIGTERM')
    const [one, two] = await Promise.all([
      api.version({ cwd: root, env: { API_TEST_VALUE: 'one' } }),
      api.version({ env: { API_TEST_VALUE: undefined } }),
    ])
    expect(JSON.parse(one.stdout).value).toBe('one')
    expect(JSON.parse(two.stdout).value).toBeUndefined()
    expect(process.cwd()).toBe(cwd)
    expect(process.env).toEqual(environment)
    expect(process.exitCode).toBe(exitCode)
    expect(process.listeners('SIGTERM')).toEqual(listeners)
  })

  test('when the child exits with a capability failure', async () => {
    const { api } = await fixture()
    await expect(
      api.build({}, { env: { API_TEST_EXIT: '4' } }),
    ).rejects.toMatchObject({
      name: 'PannonicoError',
      result: { exitCode: 4, signal: null, stderr: 'fixture diagnostic' },
    })
  })

  test('when JavaScript supplies a malformed filesystem selection', async () => {
    const { api } = await fixture()
    await expect(
      api.build({ root: null as unknown as string }),
    ).rejects.toBeInstanceOf(TypeError)
  })

  test('when the child cannot start in its selected directory', async () => {
    const { api, root } = await fixture()
    await expect(
      api.version({ cwd: path.join(root, 'missing') }),
    ).rejects.toMatchObject({
      name: 'PannonicoError',
      cause: { code: 'ENOENT' },
    })
  })

  test('when the installed CLI entrypoint is missing', async () => {
    const { api, root } = await fixture()
    await rm(path.join(root, 'dist', 'js', 'bin', 'pannonico.js'))
    await expect(api.version()).rejects.toMatchObject({
      name: 'PannonicoError',
      result: {
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: expect.stringContaining('MODULE_NOT_FOUND'),
      },
    })
  })

  test('when output splits a UTF-8 character and writes just before closure', async () => {
    const { api } = await fixture(
      `process.stdout.write(Buffer.from([0xc4])); setImmediate(() => { process.stdout.end(Buffer.from([0x8d])); process.stderr.end('last'); });`,
    )
    expect(await api.version()).toMatchObject({
      stdout: 'č',
      stderr: 'last',
      exitCode: 0,
    })
  })

  test('when the finite child attempts to consume stdin', async () => {
    const { api } = await fixture(
      `process.stdin.resume(); process.stdin.on('end', () => process.stdout.end('closed'));`,
    )
    expect((await api.version()).stdout).toBe('closed')
  })

  test('when MCP echoes protocol bytes and closes on input EOF', async () => {
    const { api } = await fixture()
    const session = api.mcp({}, { env: { API_TEST_ECHO: '1' } })
    let output = ''
    session.child.stdout?.setEncoding('utf8').on('data', chunk => {
      output += chunk
    })
    session.child.stderr?.resume()
    session.child.stdin?.end('{"jsonrpc":"2.0"}\n')
    expect(await session.completed).toMatchObject({ exitCode: 0, signal: null })
    expect(output).toBe('{"jsonrpc":"2.0"}\n')
  })

  test('when a session fails immediately after spawn', async () => {
    const { api } = await fixture()
    const session = api.mcp({}, { env: { API_TEST_EXIT: '4' } })
    session.child.stdout?.resume()
    session.child.stderr?.resume()
    await expect(session.completed).rejects.toMatchObject({
      name: 'PannonicoError',
      result: { exitCode: 4 },
    })
  })

  test.skipIf(process.platform === 'win32')(
    'when a finite child terminates by signal',
    async () => {
      const { api } = await fixture(`process.kill(process.pid, 'SIGTERM')`)
      await expect(api.version()).rejects.toMatchObject({
        result: { exitCode: null, signal: 'SIGTERM' },
      })
    },
  )

  test('when the package is imported without calling an operation', async () => {
    const { url } = await fixture(
      `throw new Error('Import must not execute the CLI')`,
    )
    const program = `
      const before=[process.cwd(),process.exitCode,process.listenerCount('SIGTERM')];
      await import(${JSON.stringify(url)});
      if (JSON.stringify(before)!==JSON.stringify([process.cwd(),process.exitCode,process.listenerCount('SIGTERM')])) throw Error('parent state changed');
    `
    const imported = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', program],
      { encoding: 'utf8' },
    )
    expect(imported.error).toBeUndefined()
    expect(imported.status).toBe(0)
    expect(imported.stdout).toBe('')
    expect(imported.stderr).toBe('')
    expect(PannonicoError.prototype).toBeInstanceOf(Error)
  })
})
