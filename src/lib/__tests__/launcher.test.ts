// Imports
// -----------------------------------------------------------------------------
// Node.js
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'

// External
import { test } from 'vitest'

// Internal
import { PackageUnavailableError } from '../artifacts.js'
import { createDebugLogger } from '../debug.js'
import { main } from '../launcher.js'
import { NativeStartupError, runNativeExecutable } from '../run-native.js'

// Types
import type { LauncherOptions } from '../launcher.js'
import type { NativeChild } from '../run-native.js'
import type { LauncherIdentity } from '../types.js'

// Fixtures
// -----------------------------------------------------------------------------

const PACKAGES = {
  native: '/launcher/node_modules/@vx.rs/pannonico-linux-x64/bin/pannonico',
  wasi: '/launcher/runtime/pannonico.wasm',
}
const LAUNCHER: LauncherIdentity = {
  edition: 'free',
  sourceRevision: 'development',
  version: '1.2.3',
  wasi: {
    path: 'runtime/pannonico.wasm',
    sha256: 'a'.repeat(64),
    size: 1,
    target: 'wasip1-wasm',
  },
}

type FakeNativeChild = EventEmitter & NativeChild

/** Creates the minimal child-process event seam used by native runner tests. */
const createNativeChild = (): FakeNativeChild => {
  const child = new EventEmitter() as FakeNativeChild
  child.kill = () => true
  return child
}

/** Reports whether an unknown Node error carries one exact code. */
const hasErrorCode = (error: unknown, code: string): boolean =>
  error !== null &&
  typeof error === 'object' &&
  'code' in error &&
  error.code === code

/**
 * createSelectionOptions supplies installed-package boundaries without filesystem I/O.
 *
 * Launcher tests override only behavior needed by each selection case. The default models a valid
 * Linux package set and lets tests assert which exact verified path reaches each process runner.
 *
 * @returns {object} Default focused launcher options.
 */
const createSelectionOptions = (): LauncherOptions => ({
  environment: {},
  platform: 'linux',
  architecture: 'x64',
  launcherIdentity: LAUNCHER,
  verifyPackage: (contract, launcher) => {
    assert.equal(launcher, LAUNCHER)
    assert.notEqual(contract.target, 'wasip1-wasm')
    return PACKAGES.native
  },
  verifyWasi: launcher => {
    assert.equal(launcher, LAUNCHER)
    return PACKAGES.wasi
  },
  debug: () => {},
})

// Launcher selection
// -----------------------------------------------------------------------------

test('Expect launcher imports to leave WASI uninitialized when no command runs', () => {
  const launcher = new URL('../../../dist/js/lib/launcher.js', import.meta.url)
    .href
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(launcher)})`,
    ],
    { encoding: 'utf8' },
  )
  assert.equal(result.status, 0, result.stderr)
  assert.doesNotMatch(result.stderr, /ExperimentalWarning: WASI/)
})

test('Expect the launcher to forward native arguments, process boundary, and exact exit status when preparing the selected runtime invocation', async () => {
  let invocation
  const environment = { TEST_VALUE: 'yes' }
  const status = await main(['build', 'site'], {
    ...createSelectionOptions(),
    environment,
    runNative: async (executable, args, options) => {
      invocation = { executable, args, options }
      return { signal: null, status: 17 }
    },
    debug: () => {},
  })
  assert.equal(status, 17)
  assert.deepEqual(invocation, {
    executable: PACKAGES.native,
    args: ['build', 'site'],
    options: { cwd: undefined, environment },
  })
})

test('Expect the launcher to emit exact fallback stderr only for unsupported host after verified WASI when preparing the selected runtime invocation', async () => {
  let output = ''
  let wasiUsed = false
  const status = await main(['--version'], {
    ...createSelectionOptions(),
    platform: 'aix',
    architecture: 'ppc64',
    stderr: { write: value => (output += value) },
    runWasi: async (module, args) => {
      wasiUsed = module === PACKAGES.wasi && args[0] === '--version'
      return 9
    },
  })
  assert.equal(status, 9)
  assert.equal(wasiUsed, true)
  assert.equal(
    output,
    'pannonico: using WASI fallback (reason=unsupported-native-host)\n',
  )
})

test('Expect the launcher to emit exact fallback stderr only for an unavailable optional native package when preparing the selected runtime invocation', async () => {
  let output = ''
  const options = createSelectionOptions()
  const status = await main([], {
    ...options,
    stderr: { write: value => (output += value) },
    verifyPackage: contract => {
      throw new PackageUnavailableError(
        contract.packageName,
        Object.assign(new Error(), { code: 'ERR_MODULE_NOT_FOUND' }),
      )
    },
    runWasi: async () => 7,
  })
  assert.equal(status, 7)
  assert.equal(
    output,
    'pannonico: using WASI fallback (reason=native-package-unavailable)\n',
  )
})

test('Expect runtime selection to verify WASI without fallback output when explicitly forced', async () => {
  let output = ''
  let nativeVerified = false
  let wasiVerified = false
  const status = await main([], {
    ...createSelectionOptions(),
    environment: { PANNONICO_FORCE_WASI: '1' },
    stderr: { write: value => (output += value) },
    verifyPackage: () => {
      nativeVerified = true
      return PACKAGES.native
    },
    verifyWasi: () => {
      wasiVerified = true
      return PACKAGES.wasi
    },
    runWasi: async () => 8,
  })
  assert.equal(status, 8)
  assert.equal(nativeVerified, false)
  assert.equal(wasiVerified, true)
  assert.equal(output, '')
})

test('Expect selection to fail without fallback when native integrity validation fails', async () => {
  let wasiUsed = false
  await assert.rejects(
    main([], {
      ...createSelectionOptions(),
      verifyPackage: () => {
        throw new Error('native package checksum mismatch')
      },
      runWasi: async () => {
        wasiUsed = true
        return 0
      },
      debug: () => {},
    }),
    /checksum mismatch/,
  )
  assert.equal(wasiUsed, false)
})

test('Expect the launcher to treat missing or corrupt bundled WASI bytes as a hard failure when preparing the selected runtime invocation', async () => {
  let output = ''
  await assert.rejects(
    main([], {
      ...createSelectionOptions(),
      environment: { PANNONICO_FORCE_WASI: '1' },
      stderr: { write: value => (output += value) },
      verifyWasi: () => {
        throw new Error('bundled WASI payload checksum mismatch')
      },
    }),
    /bundled WASI payload checksum mismatch/,
  )
  assert.equal(output, '')
})

test.each(['EACCES', 'EPERM', 'ENOENT', 'ENOEXEC'])(
  'Expect native selection to use WASI when startup fails with %s',
  async code => {
    let output = ''
    const status = await main([], {
      ...createSelectionOptions(),
      stderr: { write: value => (output += value) },
      runNative: async () => {
        throw new NativeStartupError(
          Object.assign(new Error('blocked'), { code }),
        )
      },
      runWasi: async () => 12,
    })
    assert.equal(status, 12)
    assert.equal(
      output,
      'pannonico: using WASI fallback (reason=native-executable-unusable)\n',
    )
  },
)

test('Expect selection to fail without fallback when startup error is outside the approved set', async () => {
  let wasiUsed = false
  const error = new NativeStartupError(
    Object.assign(new Error('I/O failure'), { code: 'EIO' }),
  )
  await assert.rejects(
    main([], {
      ...createSelectionOptions(),
      runNative: async () => {
        throw error
      },
      runWasi: async () => {
        wasiUsed = true
        return 0
      },
    }),
    actual => actual === error,
  )
  assert.equal(wasiUsed, false)
})

test('Expect selection to fail without fallback when a native process has already started', async () => {
  let wasiUsed = false
  const error = Object.assign(new Error('post-start failure'), {
    code: 'EACCES',
  })
  await assert.rejects(
    main([], {
      ...createSelectionOptions(),
      runNative: async () => {
        throw error
      },
      runWasi: async () => {
        wasiUsed = true
        return 0
      },
    }),
    error,
  )
  assert.equal(wasiUsed, false)
})

test('Expect the launcher to propagate a native termination signal through the parent process when preparing the selected runtime invocation', async () => {
  let received
  const status = await main([], {
    ...createSelectionOptions(),
    runNative: async () => ({ signal: 'SIGTERM', status: 1 }),
    processRef: {
      pid: 42,
      kill: (pid, signal) => {
        received = { pid, signal }
      },
    },
    debug: () => {},
  })
  assert.equal(status, 1)
  assert.deepEqual(received, { pid: 42, signal: 'SIGTERM' })
})

// Process and diagnostics
// -----------------------------------------------------------------------------

test('Expect native execution to inherit streams and context when starting a child', async () => {
  let received
  const child = createNativeChild()
  const pending = runNativeExecutable('/local/pannonico', ['--help'], {
    cwd: '/project',
    environment: { A: 'B' },
    spawnProcess: (file, args, options) => {
      received = { file, args, options }
      return child
    },
  })
  child.emit('exit', 23, null)
  assert.deepEqual(await pending, { signal: null, status: 23 })
  assert.deepEqual(received, {
    file: '/local/pannonico',
    args: ['--help'],
    options: {
      cwd: '/project',
      detached: process.platform !== 'win32',
      env: { A: 'B' },
      stdio: 'inherit',
    },
  })
})

test('Expect native execution to forward termination and remove listeners when the child closes', async () => {
  let receivedSignal
  const child = createNativeChild()
  child.kill = signal => {
    receivedSignal = signal
    return true
  }
  const signalSource = new EventEmitter()
  const pending = runNativeExecutable('/local/pannonico', [], {
    signalSource,
    spawnProcess: () => child,
  })
  signalSource.emit('SIGINT')
  assert.equal(receivedSignal, 'SIGINT')
  child.emit('exit', 0, null)
  assert.deepEqual(await pending, { signal: null, status: 0 })
  assert.equal(signalSource.listenerCount('SIGINT'), 0)
})

test('Expect native execution to remove listeners when asynchronous spawn fails', async () => {
  const child = createNativeChild()
  const signalSource = new EventEmitter()
  const pending = runNativeExecutable('/local/pannonico', [], {
    signalSource,
    spawnProcess: () => child,
  })
  const error = Object.assign(new Error('could not spawn'), { code: 'ENOENT' })
  child.emit('error', error)
  await assert.rejects(
    pending,
    actual => actual instanceof NativeStartupError && actual.cause === error,
  )
  assert.equal(signalSource.listenerCount('SIGHUP'), 0)
  assert.equal(signalSource.listenerCount('SIGINT'), 0)
  assert.equal(signalSource.listenerCount('SIGTERM'), 0)
})

test('Expect native execution to queue a signal when the child is still starting', async () => {
  let receivedSignal
  const child = createNativeChild()
  child.kill = signal => {
    receivedSignal = signal
    return true
  }
  const signalSource = new EventEmitter()
  const pending = runNativeExecutable('/local/pannonico', [], {
    signalSource,
    spawnProcess: () => {
      signalSource.emit('SIGINT')
      return child
    },
  })
  assert.equal(receivedSignal, 'SIGINT')
  child.emit('exit', 0, null)
  assert.deepEqual(await pending, { signal: null, status: 0 })
})

test('Expect native execution to remove listeners when spawn throws synchronously', async () => {
  const signalSource = new EventEmitter()
  const error = Object.assign(new Error('spawn threw'), { code: 'ENOENT' })
  const pending = runNativeExecutable('/local/pannonico', [], {
    signalSource,
    spawnProcess: () => {
      throw error
    },
  })
  await assert.rejects(
    pending,
    actual => actual instanceof NativeStartupError && actual.cause === error,
  )
  assert.equal(signalSource.listenerCount('SIGHUP'), 0)
  assert.equal(signalSource.listenerCount('SIGINT'), 0)
  assert.equal(signalSource.listenerCount('SIGTERM'), 0)
})

test('Expect native execution to preserve the original error when failure follows spawn', async () => {
  const child = createNativeChild()
  const signalSource = new EventEmitter()
  const pending = runNativeExecutable('/local/pannonico', [], {
    signalSource,
    spawnProcess: () => child,
  })
  const error = Object.assign(new Error('started child failed'), {
    code: 'EACCES',
  })
  child.emit('spawn')
  child.emit('error', error)
  await assert.rejects(pending, error)
  assert.equal(signalSource.listenerCount('SIGTERM'), 0)
})

test.skipIf(process.platform === 'win32')(
  'Expect native execution to deliver one signal when the POSIX terminal interrupts',
  async () => {
    const root = mkdtempSync(join(os.tmpdir(), 'pannonico-node-signal-'))
    const countPath = join(root, 'signal-count')
    const readyPath = join(root, 'ready')
    const runner = new URL(
      '../../../dist/js/lib/run-native.js',
      import.meta.url,
    ).href
    const childProgram = `
      const { writeFileSync } = await import("node:fs");
      let count = 0;
      process.on("SIGINT", () => {
        count += 1;
        setTimeout(() => {
          writeFileSync(${JSON.stringify(countPath)}, String(count));
          process.exit(0);
        }, 100);
      });
      writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));
      setInterval(() => {}, 1000);
    `
    const launcherProgram = `
      const { runNativeExecutable } = await import(${JSON.stringify(runner)});
      const result = await runNativeExecutable(process.execPath, [
        "--input-type=module",
        "--eval",
        ${JSON.stringify(childProgram)},
      ]);
      process.exitCode = result.status;
    `
    const launcher = spawn(
      process.execPath,
      ['--input-type=module', '--eval', launcherProgram],
      {
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    )
    let stderr = ''
    if (launcher.stderr === null)
      throw new Error('signal fixture stderr was unavailable')
    launcher.stderr.setEncoding('utf8')
    launcher.stderr.on('data', (value: string) => {
      stderr += value
    })
    let nativePID
    let cleanupError
    let exitTimeout
    const launcherPID = launcher.pid
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          nativePID = Number(readFileSync(readyPath, 'utf8'))
          break
        } catch (error) {
          if (!hasErrorCode(error, 'ENOENT')) throw error
          if (launcher.exitCode !== null || launcher.signalCode !== null) {
            throw new Error(
              `signal fixture exited before readiness with code ${launcher.exitCode} and signal ${launcher.signalCode ?? 'none'}: ${stderr}`,
            )
          }
          await new Promise(resolve => setTimeout(resolve, 20))
        }
      }
      assert.ok(
        typeof nativePID === 'number' &&
          Number.isInteger(nativePID) &&
          nativePID > 0,
        `signal fixture did not become ready: ${stderr}`,
      )
      if (nativePID === undefined || launcherPID === undefined) {
        throw new Error(
          `signal fixture process identity was unavailable: ${stderr}`,
        )
      }
      const launcherExit = once(launcher, 'exit') as Promise<
        [number | null, NodeJS.Signals | null]
      >
      process.kill(-launcherPID, 'SIGINT')
      const [status, signal] = await Promise.race<
        [number | null, NodeJS.Signals | null]
      >([
        launcherExit,
        new Promise<never>((_, reject) => {
          exitTimeout = setTimeout(
            () =>
              reject(
                new Error(
                  `signal fixture did not exit after SIGINT: ${stderr}`,
                ),
              ),
            2_000,
          )
        }),
      ])
      clearTimeout(exitTimeout)
      exitTimeout = undefined
      assert.equal(signal, null, stderr)
      assert.equal(status, 0, stderr)
      assert.equal(readFileSync(countPath, 'utf8'), '1')
    } finally {
      clearTimeout(exitTimeout)
      if (
        launcherPID !== undefined &&
        launcher.exitCode === null &&
        launcher.signalCode === null
      ) {
        try {
          process.kill(-launcherPID, 'SIGKILL')
        } catch (error) {
          if (!hasErrorCode(error, 'ESRCH')) cleanupError ??= error
        }
      }
      if (nativePID) {
        try {
          process.kill(nativePID, 'SIGKILL')
        } catch (error) {
          if (!hasErrorCode(error, 'ESRCH')) cleanupError ??= error
        }
      }
      rmSync(root, { force: true, recursive: true })
    }
    if (cleanupError) throw cleanupError
  },
)

test('Expect debug output to disclose only selected fields when diagnostics are enabled', () => {
  let output = ''
  const stderr = {
    write: (value: string) => {
      output += value
    },
  }
  createDebugLogger({}, stderr)('selected package @vx.rs/pannonico-linux-x64')
  assert.equal(output, '')
  createDebugLogger(
    { PANNONICO_LAUNCHER_DEBUG: '1' },
    stderr,
  )('execution mode WASI')
  assert.equal(output, '[pannonico launcher] execution mode WASI\n')
})
