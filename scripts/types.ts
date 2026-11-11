// Imports
// -----------------------------------------------------------------------------
// Types
import type { Edition } from '../src/lib/types.js'

// Types
// -----------------------------------------------------------------------------
/** Verified native or WASI member read from one closed Go product pair. */
export interface ProductMember {
  bytes: Buffer
  executable: boolean
  kind: 'native' | 'wasi'
  path: string
  sha256: string
  size: number
  target: string
}

/** One verified native/WASI pair selected from the Go product set. */
export interface ProductPair {
  edition: Edition
  manifestBytes: Buffer
  native: ProductMember
  pairId: string
  target: string
  wasi: ProductMember
}

/**
 * ProductSet is the fully verified package-construction input. Callers may use
 * its bytes only after the complete edition/platform tree has closed.
 */
export interface ProductSet {
  edition: Edition
  editions: Edition[]
  pairs: ProductPair[]
  productRoot: string
  productVersion: string
  setId: string
  sourceRevision: string
  wasi: ProductMember
}

/** Package construction mode determines public versus development metadata. */
export type PackageMode = 'development-pro' | 'local-free' | 'public'

/** Distribution class attached to generated npm package records. */
export type PackageDistribution = 'development' | 'public'

/** Maintainer package metadata allowed to influence generated manifests. */
export interface SourcePackageMetadata {
  author?: unknown
  engines?: unknown
  license?: unknown
  name?: unknown
  private?: unknown
}

/** Product identity fields needed to project generated npm metadata. */
export interface PackageProductIdentity {
  edition: Edition
  pairs: Array<{ target: string }>
  productVersion: string
  sourceRevision: string
  wasi: { sha256: string; size: number }
}

/** Verified artifact identity fields copied into native package metadata. */
export interface ArtifactMemberIdentity {
  sha256: string
}

/** Generated launcher manifest shared by package construction and verification. */
export interface LauncherPackageManifest {
  author: string
  bin: { pannonico: string }
  bugs?: { url: string }
  description: string
  dependencies?: never
  engines: unknown
  files: string[]
  homepage?: string
  license: string
  name: 'pannonico'
  optionalDependencies: Record<string, string>
  pannonico: {
    edition: Edition
    schema: 'npm-launcher/v2'
    sourceRevision: string
    wasi: { path: string; sha256: string; size: number; target: string }
  }
  private?: true
  publishConfig?: { access: 'public'; registry: string }
  repository?: { type: 'git'; url: string }
  scripts?: never
  main: string
  types: string
  exports: { '.': { types: string; import: string } }
  type: 'module'
  version: string
}

/** Generated native artifact manifest, which deliberately has no dependencies. */
export interface ArtifactPackageManifest {
  author: string
  bugs?: { url: string }
  cpu?: string[]
  description: string
  files: string[]
  homepage?: string
  license: string
  name: string
  os?: NodeJS.Platform[]
  pannonico: {
    edition: Edition
    payload: string
    schema: 'npm-artifact/v1'
    sha256: string
    sourceRevision: string
    target: string
  }
  private?: true
  publishConfig?: { access: 'public'; registry: string }
  repository?: { type: 'git'; url: string }
  version: string
}

/** Package descriptor type accepted by generated-tree packing. */
export interface GeneratedPackageDescriptor {
  files: string[]
  manifest: LauncherPackageManifest | ArtifactPackageManifest
  role: 'launcher' | 'native'
  root: string
  target: string
}

/** One generated package record described by the npm manifest. */
export interface PackageSetRecord {
  dependencies: Record<string, string>
  directory: string
  edition: Edition
  filename: string
  files: string[]
  name: string
  optionalDependencies: Record<string, string>
  private: boolean
  role: 'launcher' | 'native'
  sha256: string
  size: number
  target: string
}

/** Closed manifest returned after package-set verification. */
export interface PackageSetManifest {
  distribution: PackageDistribution
  edition: Edition
  packages: PackageSetRecord[]
  productVersion: string
  sourceRevision: string
}

/** Decoded npm tarball inventory used for byte-for-byte publication checks. */
export interface InspectedNpmTarball {
  contents: Map<string, Buffer>
  files: string[]
  metadata: Record<string, unknown>
}
