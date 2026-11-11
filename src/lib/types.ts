// Types
// -----------------------------------------------------------------------------
/** Pannonico editions carried by launcher and artifact identities. */
export type Edition = 'free' | 'pro'

/**
 * NativeTarget binds a Go artifact name to its npm package and Node host
 * selection. Package construction and the installed launcher share this
 * closed mapping so neither side can invent a platform alias.
 */
export interface NativeTarget {
  readonly architecture: string
  readonly packageName: string
  readonly payload: string
  readonly platform: NodeJS.Platform
  readonly target: string
}

/**
 * WasiTarget names the one launcher-local portable artifact. It remains
 * separate from native targets because it has no optional npm package.
 */
export interface WasiTarget {
  readonly payload: 'runtime/pannonico.wasm'
  readonly target: 'wasip1-wasm'
}

/** Exact package metadata that binds the bundled WASI payload bytes. */
export interface BundledWasiIdentity {
  path: string
  sha256: string
  size: number
  target: string
}

/**
 * LauncherIdentity is the validated installed-product identity used for all
 * native and WASI selection. It never comes from environment variables.
 */
export interface LauncherIdentity {
  edition: Edition
  sourceRevision: string
  version: string
  wasi: BundledWasiIdentity
}

/** Small output boundary accepted by launcher diagnostics and focused tests. */
export interface TextWriter {
  write(value: string): unknown
}

/** File-descriptor stream boundary passed to Node's preview1 WASI host. */
export interface DescriptorStream {
  readonly fd: number
}
