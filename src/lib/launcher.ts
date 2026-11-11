// Imports
// -----------------------------------------------------------------------------
// Internal
import {
  PackageUnavailableError,
  readLauncherIdentity,
  verifyBundledWasi,
  verifyInstalledPackage,
} from './artifacts.js'
import { createDebugLogger } from './debug.js'
import { NativeStartupError, runNativeExecutable } from './run-native.js'
import { selectNativeTarget, WASI_TARGET } from './targets.js'

// Types
import type { NativeExecutionResult, RunNativeOptions } from './run-native.js'
import type {
  DescriptorStream,
  LauncherIdentity,
  NativeTarget,
  TextWriter,
} from './types.js'

// Types
// -----------------------------------------------------------------------------
type FallbackReason =
  | 'native-executable-unusable'
  | 'unsupported-native-host'
  | 'native-package-unavailable'

interface LauncherProcess {
  readonly pid: number
  /** Preserve CLI signal termination through the launcher-owned process boundary. */
  kill(pid: number, signal: NodeJS.Signals): unknown
}

interface WasiExecutionOptions {
  cwd?: string | undefined
  environment?: NodeJS.ProcessEnv | undefined
  stderr?: (TextWriter & Partial<DescriptorStream>) | undefined
  stdin?: DescriptorStream | undefined
  stdout?: DescriptorStream | undefined
}

/**
 * LauncherOptions contains production defaults plus narrow dependency seams
 * used by runtime contract tests. None of these values are read from package
 * metadata or environment-controlled module paths.
 */
export interface LauncherOptions extends RunNativeOptions {
  architecture?: string | undefined
  cwd?: string | undefined
  debug?: ((message: string) => void) | undefined
  environment?: NodeJS.ProcessEnv | undefined
  launcherIdentity?: LauncherIdentity | undefined
  launcherManifestPath?: string | undefined
  platform?: NodeJS.Platform | undefined
  processRef?: LauncherProcess | undefined
  resolvePackage?: ((request: string) => string) | undefined
  runNative?:
    | ((
        executable: string,
        args: ReadonlyArray<string>,
        options: RunNativeOptions,
      ) => Promise<NativeExecutionResult>)
    | undefined
  runWasi?:
    | ((
        modulePath: string,
        args: ReadonlyArray<string>,
        options: WasiExecutionOptions,
      ) => Promise<number>)
    | undefined
  stderr?: (TextWriter & Partial<DescriptorStream>) | undefined
  stdin?: DescriptorStream | undefined
  stdout?: DescriptorStream | undefined
  verifyPackage?:
    | ((
        contract: NativeTarget,
        launcher: LauncherIdentity,
        options: LauncherOptions,
      ) => string)
    | undefined
  verifyWasi?:
    | ((launcher: LauncherIdentity, options: LauncherOptions) => string)
    | undefined
}

// Public API
// -----------------------------------------------------------------------------

/**
 * main selects and runs one verified package for an installed Pannonico CLI invocation.
 *
 * The launcher reads edition and build identity only from its generated package metadata. It tries
 * the current host's optional native package first and uses its bundled verified WASI runtime only
 * for an unsupported host, a missing native package, an approved pre-start native failure, or the
 * edition-neutral forced-WASI mode. Identity, integrity, post-start, exit, and signal failures
 * remain hard errors.
 *
 * @param {string[]} argumentsToForward Product arguments from the executable entrypoint.
 * @param {object} options Runtime and focused-test overrides.
 * @returns {Promise<number>} Exact native or WASI guest exit status.
 */
export const main = async (
  argumentsToForward: ReadonlyArray<string>,
  options: LauncherOptions = {},
): Promise<number> => {
  const environment = options.environment ?? process.env
  const platform = options.platform ?? process.platform
  const architecture = options.architecture ?? process.arch
  const launcher = options.launcherIdentity ?? readLauncherIdentity()
  const verify =
    options.verifyPackage ??
    ((
      contract: NativeTarget,
      identity: LauncherIdentity,
      runtimeOptions: LauncherOptions,
    ) => verifyInstalledPackage(contract, identity, runtimeOptions))
  const verifyWasi =
    options.verifyWasi ??
    ((identity: LauncherIdentity, runtimeOptions: LauncherOptions) =>
      verifyBundledWasi(identity, runtimeOptions))
  const runNative = options.runNative ?? runNativeExecutable
  const processRef = options.processRef ?? process
  const debug =
    options.debug ??
    createDebugLogger(environment, options.stderr ?? process.stderr)
  const nativeTarget = selectNativeTarget(platform, architecture)

  debug(`launcher version ${launcher.version}`)
  debug(`host ${platform}/${architecture}`)
  if (environment['PANNONICO_FORCE_WASI'] === '1') {
    return executeWasi(
      argumentsToForward,
      launcher,
      verifyWasi,
      options,
      environment,
      debug,
    )
  }
  if (nativeTarget === undefined) {
    return executeWasi(
      argumentsToForward,
      launcher,
      verifyWasi,
      options,
      environment,
      debug,
      'unsupported-native-host',
    )
  }

  debug(`selected package ${nativeTarget.packageName}`)
  let executable
  try {
    executable = verify(nativeTarget, launcher, options)
  } catch (error) {
    if (!(error instanceof PackageUnavailableError)) throw error
    return executeWasi(
      argumentsToForward,
      launcher,
      verifyWasi,
      options,
      environment,
      debug,
      'native-package-unavailable',
    )
  }
  debug('execution mode native')
  let result
  try {
    result = await runNative(executable, argumentsToForward, {
      cwd: options.cwd,
      environment,
    })
  } catch (error) {
    const code =
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined
    if (
      error instanceof NativeStartupError &&
      code !== undefined &&
      ['EACCES', 'EPERM', 'ENOENT', 'ENOEXEC'].includes(code)
    ) {
      return executeWasi(
        argumentsToForward,
        launcher,
        verifyWasi,
        options,
        environment,
        debug,
        'native-executable-unusable',
      )
    }
    throw error
  }
  if (result.signal) {
    processRef.kill(processRef.pid, result.signal)
    return 1
  }
  return result.status
}

// WASI execution
// -----------------------------------------------------------------------------

/**
 * executeWasi verifies the bundled portable runtime and starts it for `main`.
 *
 * Dynamic import keeps Node's experimental WASI host uninitialized during native execution. The
 * fallback diagnostic is emitted only after the package-local runtime passes integrity checks.
 *
 * @param {string[]} args Product arguments to forward.
 * @param {{edition: "free" | "pro", sourceRevision: string, version: string, wasi: Record<string, unknown>}} launcher Launcher identity.
 * @param {typeof verifyBundledWasi} verify Bundled-runtime verification boundary.
 * @param {object} options Runtime and stream overrides.
 * @param {NodeJS.ProcessEnv} environment Scoped host environment source.
 * @param {(message: string) => void} debug Debug logger.
 * @param {"native-executable-unusable" | "unsupported-native-host" | "native-package-unavailable" | undefined} fallbackReason Automatic fallback reason.
 * @returns {Promise<number>} Exact WASI guest exit status.
 */
const executeWasi = async (
  args: ReadonlyArray<string>,
  launcher: LauncherIdentity,
  verify: (launcher: LauncherIdentity, options: LauncherOptions) => string,
  options: LauncherOptions,
  environment: NodeJS.ProcessEnv,
  debug: (message: string) => void,
  fallbackReason: FallbackReason | undefined = undefined,
): Promise<number> => {
  debug(`selected bundled WASI ${WASI_TARGET.payload}`)
  const modulePath = verify(launcher, options)
  if (fallbackReason !== undefined)
    writeFallback(options.stderr ?? process.stderr, fallbackReason)
  debug('execution mode WASI')
  const runWasi =
    options.runWasi ??
    (async (selectedModule, selectedArgs, selectedOptions) => {
      const { runWasiExecutable } = await import('./run-wasi.js')
      const stderr =
        selectedOptions.stderr && typeof selectedOptions.stderr.fd === 'number'
          ? (selectedOptions.stderr as TextWriter & DescriptorStream)
          : process.stderr
      return runWasiExecutable(selectedModule, selectedArgs, {
        cwd: selectedOptions.cwd,
        environment: selectedOptions.environment,
        stderr,
        stdin: selectedOptions.stdin,
        stdout: selectedOptions.stdout,
      })
    })
  return runWasi(modulePath, args, {
    cwd: options.cwd,
    environment,
    stderr: options.stderr,
    stdin: options.stdin,
    stdout: options.stdout,
  })
}

/**
 * writeFallback emits the stable diagnostic after the bundled WASI runtime verifies.
 *
 * Forced WASI remains silent. The line records completed package selection and may precede a later
 * WASI preparation or guest failure.
 *
 * @param {{write: (value: string) => unknown}} stderr Selected standard-error stream.
 * @param {"native-executable-unusable" | "unsupported-native-host" | "native-package-unavailable"} reason Allowed reason.
 */
const writeFallback = (stderr: TextWriter, reason: FallbackReason): void => {
  stderr.write(`pannonico: using WASI fallback (reason=${reason})\n`)
}
