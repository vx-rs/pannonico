// Imports
// -----------------------------------------------------------------------------
// Node.js
import { spawn } from 'node:child_process'

// Constants
// -----------------------------------------------------------------------------

// Match the native CLI's interrupt, service-stop and hangup cancellation set.
// Other signals would change the existing terminal/process lifecycle contract.
const FORWARDED_SIGNALS = ['SIGHUP', 'SIGINT', 'SIGTERM'] as const

// Types
// -----------------------------------------------------------------------------
/** NativeChild is the minimal spawned-process contract used for signal-safe launcher tests. */
export interface NativeChild {
  /** Sends one launcher-owned termination signal to the isolated child process. */
  kill(signal?: NodeJS.Signals): boolean
  /** Registers the one-shot notification that proves native startup completed. */
  once(event: 'spawn', listener: () => void): this
  /** Registers the one-shot failure emitted before native startup completes. */
  once(event: 'error', listener: (error: Error) => void): this
  /** Registers the one-shot native exit status consumed by launcher result mapping. */
  once(
    event: 'exit',
    listener: (status: number | null, signal: NodeJS.Signals | null) => void,
  ): this
}

/** SignalSource is the process-signal subset installed and removed around one child lifecycle. */
interface SignalSource {
  /** Installs one launcher-owned host signal listener before child startup. */
  on(event: NodeJS.Signals, listener: () => void): unknown
  /** Removes the exact listener during bounded launcher cleanup. */
  removeListener(event: NodeJS.Signals, listener: () => void): unknown
}

/** Runtime seams accepted by the native process boundary and focused tests. */
export interface RunNativeOptions {
  cwd?: string | undefined
  detached?: boolean | undefined
  environment?: NodeJS.ProcessEnv | undefined
  signalSource?: SignalSource | undefined
  spawnProcess?:
    | ((
        executable: string,
        argumentsToForward: ReadonlyArray<string>,
        options: {
          cwd: string
          detached: boolean
          env: NodeJS.ProcessEnv
          stdio: 'inherit'
        },
      ) => NativeChild)
    | undefined
}

/** Exact completion state returned to the launcher after native execution. */
export interface NativeExecutionResult {
  signal: NodeJS.Signals | null
  status: number
}

// Errors
// -----------------------------------------------------------------------------

/**
 * NativeStartupError identifies a verified executable that failed before child startup completed.
 *
 * The launcher catches only this boundary for the approved WASI fallback codes. Errors emitted
 * after Node confirms the `spawn` event remain ordinary process failures and cannot re-run a user
 * command through another runtime.
 */
export class NativeStartupError extends Error {
  readonly code?: string

  /**
   * constructor preserves the platform error code without exposing post-start failures as retries.
   *
   * @param {unknown} cause Synchronous spawn exception or pre-spawn child error.
   */
  constructor(cause: unknown) {
    const code =
      cause &&
      typeof cause === 'object' &&
      'code' in cause &&
      typeof cause.code === 'string'
        ? cause.code
        : undefined
    super(`Native executable could not start${code ? ` (${code})` : ''}`, {
      cause,
    })
    this.name = 'NativeStartupError'
    if (code !== undefined) this.code = code
  }
}

// Signal lifecycle
// -----------------------------------------------------------------------------

/**
 * subscribeToSignals gives the launcher ownership of termination signals before native startup.
 *
 * runNativeExecutable installs these listeners before spawning so a startup signal can be queued
 * until the isolated child exists. The returned callback removes every listener after either
 * spawn failure or exit so repeated invocations do not accumulate global process handlers.
 */
const subscribeToSignals = (
  forwardSignal: (signal: NodeJS.Signals) => void,
  signalSource: SignalSource,
): (() => void) => {
  const listeners = new Map<NodeJS.Signals, () => void>()
  for (const signal of FORWARDED_SIGNALS) {
    /** Retain this exact signal callback so completion can remove its listener. */
    const listener = () => forwardSignal(signal)
    listeners.set(signal, listener)
    signalSource.on(signal, listener)
  }
  return () => {
    for (const [signal, listener] of listeners)
      signalSource.removeListener(signal, listener)
  }
}

// Public API
// -----------------------------------------------------------------------------

/**
 * runNativeExecutable starts one local binary with inherited streams and caller context.
 *
 * POSIX children use a separate process group so a terminal signal reaches the launcher only;
 * the listeners above then deliver it to the child exactly once. Windows keeps the default
 * process relationship because Node does not provide equivalent POSIX signal groups there.
 */
export const runNativeExecutable = (
  executable: string,
  argumentsToForward: ReadonlyArray<string>,
  options: RunNativeOptions = {},
): Promise<NativeExecutionResult> => {
  const spawnProcess = options.spawnProcess ?? spawn
  return new Promise<NativeExecutionResult>((resolve, reject) => {
    let child: NativeChild | undefined
    const pendingSignals: NodeJS.Signals[] = []
    const unsubscribe = subscribeToSignals(signal => {
      if (child) child.kill(signal)
      else pendingSignals.push(signal)
    }, options.signalSource ?? process)
    try {
      child = spawnProcess(executable, [...argumentsToForward], {
        cwd: options.cwd ?? process.cwd(),
        detached: options.detached ?? process.platform !== 'win32',
        env: options.environment ?? process.env,
        stdio: 'inherit',
      })
    } catch (error) {
      unsubscribe()
      reject(new NativeStartupError(error))
      return
    }
    let finished = false
    let started = false
    child.once('spawn', () => {
      started = true
    })
    child.once('error', error => {
      if (!finished) {
        finished = true
        unsubscribe()
        reject(started ? error : new NativeStartupError(error))
      }
    })
    child.once('exit', (status, signal) => {
      if (!finished) {
        finished = true
        unsubscribe()
        resolve({ signal, status: status ?? 1 })
      }
    })
    for (const signal of pendingSignals) child.kill(signal)
  })
}
