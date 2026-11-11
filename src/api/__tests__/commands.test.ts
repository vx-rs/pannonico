// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'

// External
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Internal
import {
  build,
  capabilities,
  help,
  manual,
  mcp,
  scaffold,
  signingDns,
  version,
  watch,
} from '../../index.js'
import { PannonicoError } from '../pannonico-error.js'

// Types
import type { ChildProcess } from 'node:child_process'
import type {
  BuildOptions,
  ExecutionOptions,
  HelpTopic,
  RootOptions,
} from '../types.js'

// Constants
// -----------------------------------------------------------------------------
const PROCESS = vi.hoisted(() => ({
  runCommand: vi.fn(),
  startProcess: vi.fn(),
}))
// Match only the process boundary. Command serialization and the supported root
// exports execute as authored TypeScript, independently of any installed binary.
vi.mock('../run-command.js', () => ({ runCommand: PROCESS.runCommand }))
vi.mock('../start-process.js', () => ({ startProcess: PROCESS.startProcess }))

const RESULT = {
  exitCode: 0,
  signal: null,
  stdout: 'binary output\n',
  stderr: 'binary diagnostic\n',
}
// Command tests preserve the handle by identity; process methods are exercised
// in process.test.ts rather than simulated by this inert handle placeholder.
const SESSION = {
  child: {} as ChildProcess,
  completed: Promise.resolve(RESULT),
}
const FINITE = [
  ['build', () => build(), ['build']],
  ['scaffold', () => scaffold(), ['scaffold']],
  ['manual', () => manual(), ['manual']],
  ['signingDns', () => signingDns(), ['signing-dns']],
  ['capabilities', () => capabilities(), ['capabilities']],
  ['version', () => version(), ['--version']],
  ['help', () => help(), ['help']],
] as const

// Each expected token comes from the existing Go CLI, not the production map.
const BUILD_VALUES: [
  keyof BuildOptions,
  string | number | readonly string[],
  string[],
][] = [
  ['config', '--help', ['--config=--help']],
  ['pages', 'a b', ['--pages=a b']],
  ['layouts', '', ['--layouts=']],
  ['partials', 'partials', ['--partials=partials']],
  ['data', 'input', ['--data=input']],
  ['dataUrls', [], []],
  [
    'dataUrls',
    ['https://example.test/a,b', 'https://example.test/b'],
    [
      '--data-url=https://example.test/a,b',
      '--data-url=https://example.test/b',
    ],
  ],
  ['out', 'output', ['--out=output']],
  ['defaultLayout', 'base', ['--default-layout=base']],
  ['defaultLanguage', 'sr', ['--default-language=sr']],
  ['htmlValidation', 'off', ['--html-validation=off']],
  ['htmlValidation', 'warn', ['--html-validation=warn']],
  ['htmlValidation', 'error', ['--html-validation=error']],
  ['maxOutputWorkers', 0, ['--max-output-workers=0']],
  ['jobs', 4, ['--jobs=4']],
  ['reportJson', 'reports/build.json', ['--report-json=reports/build.json']],
]
const BUILD_BOOLEANS = [
  ['dryRun', 'dry-run'],
  ['quiet', 'quiet'],
  ['verbose', 'verbose'],
  ['noColor', 'no-color'],
  ['beautify', 'beautify'],
  ['minify', 'minify'],
  ['help', 'help'],
] as const
const SCAFFOLD_BOOLEANS = [
  ['empty', 'empty'],
  ['min', 'min'],
  ['vite', 'vite'],
  ['withDocs', 'with-docs'],
  ['force', 'force'],
  ['help', 'help'],
] as const
const ROOT_COMMANDS: [
  string,
  (options?: RootOptions, execution?: ExecutionOptions) => unknown,
  'finite' | 'watch' | 'mcp',
][] = [
  ['build', build, 'finite'],
  ['scaffold', scaffold, 'finite'],
  ['manual', manual, 'finite'],
  ['signing-dns', signingDns, 'finite'],
  ['watch', watch, 'watch'],
  ['mcp', mcp, 'mcp'],
]
const HELP_TOPICS: HelpTopic[] = [
  'build',
  'watch',
  'scaffold',
  'manual',
  'mcp',
  'signing-dns',
  'capabilities',
]

// Tests
// -----------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  PROCESS.runCommand.mockResolvedValue(RESULT)
  PROCESS.startProcess.mockReturnValue(SESSION)
})

describe.each(FINITE)(
  'Expect %s to preserve finite binary results',
  (_name, invoke, args) => {
    test('when command options are omitted', async () => {
      expect(await invoke()).toBe(RESULT)
      expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(args, {})
      expect(PROCESS.startProcess).not.toHaveBeenCalled()
    })

    test.each([1, 2, 3, 4])(
      'when the binary rejects with exit class %s',
      async exitCode => {
        const error = new PannonicoError('binary failure', {
          ...RESULT,
          exitCode,
        })
        PROCESS.runCommand.mockRejectedValueOnce(error)
        await expect(invoke()).rejects.toBe(error)
      },
    )
  },
)

describe('Expect build to expose every build option', () => {
  test.each(BUILD_VALUES)(
    'when %s is supplied as %j',
    async (property, value, args) => {
      await build({ [property]: value })
      expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
        ['build', ...args],
        {},
      )
    },
  )

  describe.each(BUILD_BOOLEANS)(
    'Expect build to preserve %s',
    (property, flag) => {
      test.each([true, false])('when explicitly set to %s', async value => {
        await build({ [property]: value })
        expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
          ['build', `--${flag}=${value}`],
          {},
        )
      })
      test('when undefined retains the binary default', async () => {
        await build({ [property]: undefined })
        expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
          ['build'],
          {},
        )
      })
    },
  )

  test('when options and repeated URL inputs are frozen', async () => {
    const options = Object.freeze({
      dataUrls: Object.freeze(['https://example.test/a']),
      dryRun: true,
    })
    await build(options)
    expect(options.dataUrls).toEqual(['https://example.test/a'])
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['build', '--data-url=https://example.test/a', '--dry-run=true'],
      {},
    )
  })
})

describe.each(SCAFFOLD_BOOLEANS)(
  'Expect scaffold to preserve %s',
  (property, flag) => {
    test.each([true, false])('when explicitly set to %s', async value => {
      await scaffold({ [property]: value })
      expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
        ['scaffold', `--${flag}=${value}`],
        {},
      )
    })
  },
)

describe('Expect manual to expose ejection and help independently', () => {
  test.each([true, false])('when eject is %s', async eject => {
    await manual({ eject })
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['manual', `--eject=${eject}`],
      {},
    )
  })
  test.each([true, false])('when help is %s', async help => {
    await manual({ help })
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['manual', `--help=${help}`],
      {},
    )
  })
})

describe('Expect signingDns to retain its command-specific grammar', () => {
  test.each(['', '--help', 'keys/config č.yaml'])(
    'when config is %j',
    async config => {
      await signingDns({ config })
      expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
        ['signing-dns', '--config', config],
        {},
      )
    },
  )
  test.each([true, false])('when help is %s', async help => {
    await signingDns({ help })
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['signing-dns', ...(help ? ['--help'] : [])],
      {},
    )
  })
})

describe('Expect informational commands to retain the binary output contract', () => {
  test.each([true, false])('when capabilities help is %s', async help => {
    await capabilities({ help })
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['capabilities', ...(help ? ['--help'] : [])],
      {},
    )
  })
  test.each(HELP_TOPICS)('when requesting help for %s', async topic => {
    await help(topic)
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['help', topic],
      {},
    )
  })
  test('when version receives execution context without command options', async () => {
    const execution = { cwd: 'workspace', env: { SOURCE_DATE_EPOCH: '0' } }
    expect(await version(execution)).toBe(RESULT)
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['--version'],
      execution,
    )
  })
})

describe.each(ROOT_COMMANDS)(
  'Expect %s to preserve project selection',
  (command, invoke, mode) => {
    test.each([undefined, '', '--site č', path.resolve('absolute-site')])(
      'when root is %j',
      async root => {
        const execution = {
          cwd: path.resolve('workspace'),
          env: { CUSTOM: 'value' },
        }
        const options = root === undefined ? {} : { root }
        const expectedRoot =
          root === undefined
            ? []
            : [root === '' ? '' : path.resolve(execution.cwd, root)]
        await invoke(options, execution)
        const adapter =
          mode === 'finite' ? PROCESS.runCommand : PROCESS.startProcess
        expect(adapter).toHaveBeenCalledExactlyOnceWith(
          [command, ...expectedRoot],
          execution,
          ...(mode === 'finite' ? [] : [mode]),
        )
      },
    )
  },
)

describe('Expect watch to expose every applicable build and server flag', () => {
  test.each(
    BUILD_VALUES.filter(
      ([property]) => property !== 'data' && property !== 'dataUrls',
    ),
  )('when %s is supplied as %j', (property, value, args) => {
    expect(watch({ [property]: value })).toBe(SESSION)
    expect(PROCESS.startProcess).toHaveBeenCalledExactlyOnceWith(
      ['watch', ...args],
      {},
      'watch',
    )
  })
  describe.each(BUILD_BOOLEANS.filter(([property]) => property !== 'dryRun'))(
    'Expect watch to preserve %s',
    (property, flag) => {
      test.each([true, false])('when explicitly set to %s', value => {
        watch({ [property]: value })
        expect(PROCESS.startProcess).toHaveBeenCalledExactlyOnceWith(
          ['watch', `--${flag}=${value}`],
          {},
          'watch',
        )
      })
    },
  )
  test.each([
    [{ host: '--help' }, '--host=--help'],
    [{ port: 0 }, '--port=0'],
    [{ open: true }, '--open=true'],
    [{ open: false }, '--open=false'],
  ] as const)('when server options are %j', (options, flag) => {
    watch(options)
    expect(PROCESS.startProcess).toHaveBeenCalledExactlyOnceWith(
      ['watch', flag],
      {},
      'watch',
    )
  })
  test('when server and build options are omitted', () => {
    expect(watch()).toBe(SESSION)
    expect(PROCESS.startProcess).toHaveBeenCalledExactlyOnceWith(
      ['watch'],
      {},
      'watch',
    )
  })
})

describe('Expect mcp to return its caller-owned process handle', () => {
  test.each([true, false])('when help is %s', help => {
    expect(mcp({ help })).toBe(SESSION)
    expect(PROCESS.startProcess).toHaveBeenCalledExactlyOnceWith(
      ['mcp', ...(help ? ['--help'] : [])],
      {},
      'mcp',
    )
  })
  test('when no session options are supplied', () => {
    expect(mcp()).toBe(SESSION)
    expect(PROCESS.startProcess).toHaveBeenCalledExactlyOnceWith(
      ['mcp'],
      {},
      'mcp',
    )
  })
})

// Session failures remain observable through the same handle the caller owns.
describe.each([
  ['watch', watch],
  ['mcp', mcp],
] as const)('Expect %s to preserve session failures', (_name, invoke) => {
  test('when the process cannot be created synchronously', () => {
    const error = new PannonicoError('spawn failed')
    PROCESS.startProcess.mockImplementationOnce(() => {
      throw error
    })
    expect(() => invoke()).toThrow(error)
  })
  test('when the session fails after creation', async () => {
    const error = new PannonicoError('unsupported', {
      exitCode: 4,
      signal: null,
    })
    const session = { child: SESSION.child, completed: Promise.reject(error) }
    PROCESS.startProcess.mockReturnValueOnce(session)
    const returned = invoke()
    expect(returned).toBe(session)
    await expect(returned.completed).rejects.toBe(error)
  })
})

describe('Expect shared invocation options to retain their defaults', () => {
  test('when a relative project has no explicit cwd', async () => {
    await build({ root: 'site' })
    expect(PROCESS.runCommand).toHaveBeenCalledExactlyOnceWith(
      ['build', path.resolve('site')],
      {},
    )
  })
  test('when informational calls receive cwd and environment', async () => {
    const execution = { cwd: 'workspace', env: { CUSTOM: 'value' } }
    await capabilities({}, execution)
    expect(PROCESS.runCommand).toHaveBeenLastCalledWith(
      ['capabilities'],
      execution,
    )
    await help(undefined, execution)
    expect(PROCESS.runCommand).toHaveBeenLastCalledWith(['help'], execution)
  })
})
