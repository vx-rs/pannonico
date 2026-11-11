// Imports
// -----------------------------------------------------------------------------
// Node.js
import assert from 'node:assert/strict'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  access,
} from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// External
import {
  build,
  capabilities,
  help,
  manual,
  mcp,
  PannonicoError,
  scaffold,
  signingDns,
  version,
  watch,
} from 'pannonico'

// Types
import type { PannonicoProcess } from 'pannonico'

// Constants
// -----------------------------------------------------------------------------
const EDITION = process.argv[2]
const WASI = process.env['PANNONICO_FORCE_WASI'] === '1'
const KEYS = process.argv[3]!

// Functions
// -----------------------------------------------------------------------------
/** Reserve an OS-selected test port briefly so fixtures do not depend on a developer's fixed port. */
const freePort = async (): Promise<number> => {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as net.AddressInfo
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve())),
  )
  return address.port
}

/** Poll only this controlled test server while allowing the existing watcher to observe a write. */
const waitForPage = async (url: string, text: string): Promise<void> => {
  // This test budget covers startup and filesystem polling, not product retry policy.
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      if ((await (await fetch(url)).text()).includes(text)) return
    } catch {
      /* The server may still be starting. */
    }
    await delay(50)
  }
  throw new Error('API watch did not serve the expected fixture state')
}

/** Connect a real MCP initialization request and close its caller-owned input after the response. */
const initializeMcp = async (session: PannonicoProcess): Promise<void> => {
  const completed = session.completed
  session.child.stderr?.resume()
  try {
    const initialized = new Promise<void>((resolve, reject) => {
      let input = ''
      session.child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
        input += chunk
        let newline: number
        while ((newline = input.indexOf('\n')) >= 0) {
          const message = JSON.parse(input.slice(0, newline))
          input = input.slice(newline + 1)
          if (message.id === 1) {
            if (message.error || !message.result?.serverInfo)
              reject(new Error('MCP initialization failed'))
            else resolve()
          }
        }
      })
      completed.then(
        () => reject(new Error('MCP closed before initialization')),
        reject,
      )
    })
    // MCP's initialization envelope negotiates the protocol before any tools run.
    session.child.stdin?.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'pannonico-api-test', version: '1' },
        },
      }) + '\n',
    )
    await initialized
    session.child.stdin?.end()
    await completed
  } finally {
    if (session.child.exitCode === null && !session.child.killed)
      session.child.kill()
  }
}

// Acceptance
// -----------------------------------------------------------------------------
const SCRATCH = await mkdtemp(
  path.join(os.tmpdir(), 'pannonico-api-installed-'),
)
try {
  const leaf = '--site č'
  const root = path.join(SCRATCH, leaf)
  await mkdir(root)
  const execution = { cwd: SCRATCH }
  assert.ok((await version()).stdout.includes(`(${EDITION},`))
  assert.ok((await capabilities()).stdout.includes('html-generation'))
  assert.ok((await help('build')).stdout.length > 0)
  assert.ok((await signingDns({ help: true })).stdout.length > 0)
  await scaffold({ root: leaf, min: true }, execution)
  await mkdir(path.join(root, 'pages'))
  await mkdir(path.join(root, 'input'))
  await writeFile(
    path.join(root, 'pages', 'index.html'),
    '<!doctype html><html><body>Initial {{.data.person.name}}</body></html>',
  )
  await writeFile(path.join(root, 'input', 'person.json'), '{"name":"API"}')
  await manual({ root: leaf, eject: true }, execution)
  await access(path.join(root, 'documentation', 'README.md'))
  const options = {
    root: leaf,
    data: path.join(leaf, 'input'),
    out: 'output',
    reportJson: path.join(leaf, 'report.json'),
    quiet: true,
    noColor: true,
    ...(!WASI ? { jobs: 2 } : EDITION === 'pro' ? { jobs: 1 } : {}),
  }
  await build(options, execution)
  assert.match(
    await readFile(path.join(root, 'output', 'index.html'), 'utf8'),
    /Initial API/,
  )
  const report = JSON.parse(
    await readFile(path.join(root, 'report.json'), 'utf8'),
  )
  assert.equal(report.schemaVersion, 1)
  assert.equal(report.success, true)
  await build({ ...options, out: 'dry-output', dryRun: true }, execution)
  await assert.rejects(access(path.join(root, 'dry-output')))
  assert.equal(
    JSON.parse(await readFile(path.join(root, 'report.json'), 'utf8')).dryRun,
    true,
  )
  await assert.rejects(
    build({ root, quiet: true, verbose: true }),
    error => error instanceof PannonicoError && error.result?.exitCode === 2,
  )
  if (EDITION === 'free') {
    await assert.rejects(
      build({ root, beautify: true }),
      error => error instanceof PannonicoError && error.result?.exitCode === 4,
    )
  } else {
    await build({ ...options, beautify: true }, execution)
    await build({ ...options, minify: true }, execution)
    await copyFile(path.join(KEYS, 'key'), path.join(root, 'key'))
    await copyFile(path.join(KEYS, 'key.pub'), path.join(root, 'key.pub'))
    await writeFile(
      path.join(root, 'pannonico.yaml'),
      'version: 1\npaths:\n  data: input\nsite:\n  url: https://example.com\nsigning:\n  enabled: true\n  privateKey: key\n  publicKey: key.pub\n',
    )
    assert.match(
      (await signingDns({ root })).stdout,
      /_pannonico\.example\.com/,
    )
  }
  await initializeMcp(mcp({ root }))
  if (EDITION !== 'pro' || WASI) {
    await assert.rejects(
      watch({ root }).completed,
      error => error instanceof PannonicoError && error.result?.exitCode === 4,
    )
  } else if (process.platform !== 'win32') {
    const port = await freePort()
    const session = watch({ root, port, quiet: true })
    const completion = session.completed
    // Observe early failure while waiting for actual HTTP readiness, not spawn.
    const observed = completion.catch(error => error)
    try {
      const url = `http://127.0.0.1:${port}/`
      await waitForPage(url, 'Initial')
      await writeFile(
        path.join(root, 'pages', 'index.html'),
        '<!doctype html><html><body>Updated</body></html>',
      )
      await waitForPage(url, 'Updated')
    } finally {
      session.child.kill('SIGTERM')
      await observed
    }
    assert.equal((await completion).exitCode, 0)
  }
} finally {
  await rm(SCRATCH, { recursive: true, force: true })
}
