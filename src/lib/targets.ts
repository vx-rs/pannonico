// Imports
// -----------------------------------------------------------------------------
// Types
import type { NativeTarget, WasiTarget } from './types.js'

// Constants
// -----------------------------------------------------------------------------
const NATIVE_TARGET_DATA = [
  ['darwin-amd64', 'darwin', 'x64', 'darwin-x64'],
  ['darwin-arm64', 'darwin', 'arm64', 'darwin-arm64'],
  ['linux-amd64', 'linux', 'x64', 'linux-x64'],
  ['linux-arm64', 'linux', 'arm64', 'linux-arm64'],
  ['windows-amd64', 'win32', 'x64', 'win32-x64'],
  ['windows-arm64', 'win32', 'arm64', 'win32-arm64'],
] as const satisfies ReadonlyArray<
  readonly [string, NodeJS.Platform, string, string]
>

// Types
// -----------------------------------------------------------------------------
type NativeTargetMatrix = readonly [
  NativeTarget,
  NativeTarget,
  NativeTarget,
  NativeTarget,
  NativeTarget,
  NativeTarget,
]

// Public API
// -----------------------------------------------------------------------------

/**
 * NATIVE_TARGETS defines the complete package and host mapping shared by construction and runtime.
 *
 * Go target names remain contract identities. Public package suffixes, Node platform names, and CPU
 * names use npm conventions such as `win32` and `x64` rather than `windows` and `amd64`.
 */
export const NATIVE_TARGETS = Object.freeze(
  NATIVE_TARGET_DATA.map(([target, platform, architecture, packageSuffix]) =>
    Object.freeze({
      architecture,
      packageName: `@vx.rs/pannonico-${packageSuffix}`,
      payload: target.startsWith('windows-')
        ? 'bin/pannonico.exe'
        : 'bin/pannonico',
      platform,
      target,
    }),
  ),
) as unknown as NativeTargetMatrix

/**
 * WASI_TARGET defines the launcher-local portable runtime used when native selection fails.
 *
 * Package construction copies the verified Go member to this exact path. Runtime validation keeps
 * the path and target closed so metadata cannot redirect fallback outside the installed launcher.
 */
export const WASI_TARGET: Readonly<WasiTarget> = Object.freeze({
  payload: 'runtime/pannonico.wasm',
  target: 'wasip1-wasm',
})

/**
 * selectNativeTarget maps one Node host tuple to its optional package contract.
 *
 * The launcher uses an undefined result as the only unsupported-host signal. The function does not
 * alias unplanned architectures or inspect environment variables.
 *
 * @param {string} platform Node platform name.
 * @param {string} architecture Node architecture name.
 * @returns {(typeof NATIVE_TARGETS)[number] | undefined} Exact native contract when supported.
 */
export const selectNativeTarget = (
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): NativeTarget | undefined =>
  NATIVE_TARGETS.find(
    candidate =>
      candidate.platform === platform &&
      candidate.architecture === architecture,
  )

/**
 * nativeTargetByName returns the declared package contract for one Go target identifier.
 *
 * Package construction uses this closed lookup after validating `product-set/v1`. An undefined
 * result makes an unknown producer target fail instead of creating an unplanned npm package.
 *
 * @param {string} target Go target identifier.
 * @returns {(typeof NATIVE_TARGETS)[number] | undefined} Exact package contract when declared.
 */
export const nativeTargetByName = (target: string): NativeTarget | undefined =>
  NATIVE_TARGETS.find(candidate => candidate.target === target)
