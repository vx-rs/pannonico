// Imports
// -----------------------------------------------------------------------------
// Internal
import { nativeTargetByName, WASI_TARGET } from '../src/lib/targets.js'

// Types
import type { NativeTarget } from '../src/lib/types.js'
import type {
  ArtifactPackageManifest,
  ArtifactMemberIdentity,
  LauncherPackageManifest,
  PackageDistribution,
  PackageProductIdentity,
  SourcePackageMetadata,
} from './types.js'

// Constants
// -----------------------------------------------------------------------------

const PACKAGE_VERSION =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const AUTHOR = 'Vladimir Jovanovic'
const DUAL_LICENSE =
  '(PolyForm-Noncommercial-1.0.0 OR PolyForm-Small-Business-1.0.0)'
const PUBLIC_METADATA = Object.freeze({
  bugs: Object.freeze({ url: 'https://github.com/vx-rs/pannonico/issues' }),
  homepage: 'https://github.com/vx-rs/pannonico',
  repository: Object.freeze({
    type: 'git',
    url: 'https://github.com/vx-rs/pannonico',
  }),
})

/**
 * LICENSE_DIGESTS binds every public npm package to the approved chooser and official terms.
 *
 * Source and generated-package verification use these values so legal content cannot drift while
 * package metadata and tarball identities remain otherwise valid.
 */
export const LICENSE_DIGESTS = Object.freeze({
  LICENSE: '9f30dca948bd498d551be7c4f138bca08792e41f750161e2a50e82b679199ed3',
  'LICENSES/PolyForm-Noncommercial-1.0.0.md':
    'c0ea4a896d2c8c394b29f9427589996db826cd501c512279ff0ed3ef48fabbe5',
  'LICENSES/PolyForm-Small-Business-1.0.0.md':
    '03eea824bff13316b767424b3e8f49538b46e52d897aecc87d6344343364aa56',
})
const COMMON_FILES = [...Object.keys(LICENSE_DIGESTS), 'README.md']

/**
 * SOURCE_PACKAGE_FILES is the exact generated launcher's public runtime payload.
 *
 * Package construction copies these paths from compiled runtime output plus reviewed legal files.
 * TypeScript, tests, workspaces, caches, and Go artifacts cannot enter the public package implicitly.
 */
export const SOURCE_PACKAGE_FILES = Object.freeze([
  ...COMMON_FILES,
  'dist/js/index.js',
  'dist/js/bin/pannonico.js',
  'dist/js/lib/artifacts.js',
  'dist/js/lib/debug.js',
  'dist/js/lib/launcher.js',
  'dist/js/lib/run-native.js',
  'dist/js/lib/run-wasi.js',
  'dist/js/lib/targets.js',
  'dist/js/lib/types.js',
  'dist/js/api/types.js',
  'dist/js/api/pannonico-error.js',
  'dist/js/api/arguments.js',
  'dist/js/api/start-process.js',
  'dist/js/api/run-command.js',
  'dist/js/api/build.js',
  'dist/js/api/scaffold.js',
  'dist/js/api/manual.js',
  'dist/js/api/signing-dns.js',
  'dist/js/api/watch.js',
  'dist/js/api/mcp.js',
  'dist/js/api/capabilities.js',
  'dist/js/api/version.js',
  'dist/js/api/help.js',
  'dist/types/index.d.ts',
  'dist/types/bin/pannonico.d.ts',
  'dist/types/lib/artifacts.d.ts',
  'dist/types/lib/debug.d.ts',
  'dist/types/lib/launcher.d.ts',
  'dist/types/lib/run-native.d.ts',
  'dist/types/lib/run-wasi.d.ts',
  'dist/types/lib/targets.d.ts',
  'dist/types/lib/types.d.ts',
  'dist/types/api/types.d.ts',
  'dist/types/api/pannonico-error.d.ts',
  'dist/types/api/arguments.d.ts',
  'dist/types/api/start-process.d.ts',
  'dist/types/api/run-command.d.ts',
  'dist/types/api/build.d.ts',
  'dist/types/api/scaffold.d.ts',
  'dist/types/api/manual.d.ts',
  'dist/types/api/signing-dns.d.ts',
  'dist/types/api/watch.d.ts',
  'dist/types/api/mcp.d.ts',
  'dist/types/api/capabilities.d.ts',
  'dist/types/api/version.d.ts',
  'dist/types/api/help.d.ts',
  'package.json',
])

/** Exact built runtime payload accepted when dry-packing the private maintainer package. */
export const PRIVATE_SOURCE_PACKAGE_FILES = SOURCE_PACKAGE_FILES

/**
 * LAUNCHER_FILES is the exact generated launcher tarball payload including bundled WASI bytes.
 *
 * Only the disposable builder may add the verified Go module to the checked-in runtime sources.
 * Separating these allowlists keeps the non-publishable maintainer package free of generated artifacts.
 */
export const LAUNCHER_FILES = Object.freeze([
  ...SOURCE_PACKAGE_FILES,
  WASI_TARGET.payload,
])

/**
 * ARTIFACT_FILES defines the fixed metadata, documentation, and legal payload around one member.
 */
export const ARTIFACT_FILES = Object.freeze([...COMMON_FILES, 'package.json'])

// Public metadata
// -----------------------------------------------------------------------------

/**
 * validateNpmVersion rejects Go-legal product versions that npm cannot publish or install exactly.
 *
 * The accepted subset covers ordinary SemVer and prerelease identifiers without build metadata.
 * Keeping this check package-owned prevents npm from normalizing an artifact identity later.
 *
 * @param {unknown} value Go product version candidate.
 * @returns {string} Valid npm package version.
 */
export const validateNpmVersion = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error(
      `Product version ${JSON.stringify(value)} is not a supported npm version`,
    )
  }
  const match = PACKAGE_VERSION.exec(value)
  if (
    match === null ||
    (match[4] !== undefined &&
      match[4].split('.').some(part => /^0[0-9]+$/.test(part)))
  ) {
    throw new Error(
      `Product version ${JSON.stringify(value)} is not a supported npm version`,
    )
  }
  return value
}

/**
 * validateSourceMetadata keeps generated packages bound to the reviewed maintainer metadata contract.
 *
 * Both launcher and artifact construction call this before projecting public metadata. It prevents
 * a source-package rename, license edit, or author edit from silently changing disposable output.
 *
 * @param {Record<string, unknown>} source Checked-in maintainer package metadata.
 */
const validateSourceMetadata = (source: SourcePackageMetadata): void => {
  if (
    source.name !== '@vx.rs/pannonico' ||
    source.private !== true ||
    source.author !== AUTHOR ||
    source.license !== DUAL_LICENSE
  ) {
    throw new Error('checked-in launcher source package metadata is invalid')
  }
}

/**
 * createLauncherManifest generates the installed wrapper's exact dependency and identity metadata.
 *
 * Free output uses the public package shape. Development Pro output keeps the same bundled-runtime
 * topology but is marked private and omits publish configuration. The source manifest is never
 * mutated.
 *
 * @param {Record<string, unknown>} source Checked-in non-publishable maintainer package metadata.
 * @param {Record<string, unknown>} product Verified selected product set.
 * @param {"public" | "development"} distribution Output distribution policy.
 * @returns {Record<string, unknown>} Disposable launcher package metadata.
 */
export const createLauncherManifest = (
  source: SourcePackageMetadata,
  product: PackageProductIdentity,
  distribution: PackageDistribution,
): LauncherPackageManifest => {
  const version = validateNpmVersion(product.productVersion)
  validateSourceMetadata(source)
  if (distribution === 'public' && product.edition !== 'free') {
    throw new Error('public package metadata rejects Pro product artifacts')
  }
  if (distribution !== 'public' && distribution !== 'development') {
    throw new Error('package distribution must be public or development')
  }
  const nativeContracts = product.pairs.map(pair => {
    const contract = nativeTargetByName(pair.target)
    if (contract === undefined)
      throw new Error(`unsupported native package target ${pair.target}`)
    return contract
  })
  const manifest: LauncherPackageManifest = {
    name: 'pannonico',
    version,
    description:
      'Verified native launcher with bundled WASI fallback for Pannonico',
    license: DUAL_LICENSE,
    author: AUTHOR,
    bin: { pannonico: './dist/js/bin/pannonico.js' },
    files: ['dist/js/', 'dist/types/', 'runtime/', ...COMMON_FILES],
    type: 'module',
    main: './dist/js/index.js',
    types: './dist/types/index.d.ts',
    exports: {
      '.': { types: './dist/types/index.d.ts', import: './dist/js/index.js' },
    },
    optionalDependencies: Object.fromEntries(
      nativeContracts.map(contract => [contract.packageName, version]),
    ),
    engines: source.engines,
    pannonico: {
      edition: product.edition,
      schema: 'npm-launcher/v2',
      sourceRevision: product.sourceRevision,
      wasi: {
        path: WASI_TARGET.payload,
        sha256: product.wasi.sha256,
        size: product.wasi.size,
        target: WASI_TARGET.target,
      },
    },
  }
  if (distribution === 'public') {
    manifest.bugs = { ...PUBLIC_METADATA.bugs }
    manifest.homepage = PUBLIC_METADATA.homepage
    manifest.publishConfig = {
      access: 'public',
      registry: 'https://registry.npmjs.org',
    }
    manifest.repository = { ...PUBLIC_METADATA.repository }
  } else {
    manifest.private = true
  }
  return manifest
}

/**
 * createArtifactManifest generates one dependency-free native package manifest.
 *
 * The payload digest comes directly from the verified Go member. Native package, OS, and CPU names
 * use Node conventions while the embedded target identity retains the Go contract name.
 *
 * @param {Record<string, unknown>} source Checked-in source metadata for legal fields.
 * @param {Record<string, unknown>} product Verified selected product set.
 * @param {Record<string, string>} contract Native package contract.
 * @param {{sha256: string}} member Verified Go member metadata.
 * @param {"public" | "development"} distribution Output distribution policy.
 * @returns {Record<string, unknown>} Disposable artifact package metadata.
 */
export const createArtifactManifest = (
  source: SourcePackageMetadata,
  product: PackageProductIdentity,
  contract: NativeTarget,
  member: ArtifactMemberIdentity,
  distribution: PackageDistribution,
): ArtifactPackageManifest => {
  validateSourceMetadata(source)
  if (distribution === 'public' && product.edition !== 'free') {
    throw new Error('public artifact metadata rejects Pro product artifacts')
  }
  const manifest: ArtifactPackageManifest = {
    name: contract.packageName,
    version: validateNpmVersion(product.productVersion),
    description: `Pannonico ${contract.target} executable artifact`,
    license: DUAL_LICENSE,
    author: AUTHOR,
    files: [contract.payload, ...COMMON_FILES],
    pannonico: {
      edition: product.edition,
      payload: contract.payload,
      schema: 'npm-artifact/v1',
      sha256: member.sha256,
      sourceRevision: product.sourceRevision,
      target: contract.target,
    },
  }
  if (contract.platform !== undefined) {
    manifest.os = [contract.platform]
    manifest.cpu = [contract.architecture]
  }
  if (distribution === 'public') {
    manifest.bugs = { ...PUBLIC_METADATA.bugs }
    manifest.homepage = PUBLIC_METADATA.homepage
    manifest.publishConfig = {
      access: 'public',
      registry: 'https://registry.npmjs.org',
    }
    manifest.repository = { ...PUBLIC_METADATA.repository }
  } else {
    manifest.private = true
  }
  return manifest
}

/**
 * packageDirectory returns the stable generated-tree directory for one package name.
 *
 * @param {string} packageName Exact generated package name.
 * @returns {string} Portable single-segment directory name.
 */
export const packageDirectory = (packageName: string): string =>
  packageName === 'pannonico'
    ? 'pannonico'
    : packageName.slice('@vx.rs/'.length)

/**
 * tarballFilename returns the package-set-owned stable filename used by offline file dependencies.
 *
 * @param {string} packageName Exact generated package name.
 * @param {string} version Valid npm version.
 * @returns {string} Portable tarball filename.
 */
export const tarballFilename = (packageName: string, version: string): string =>
  `${packageDirectory(packageName)}-${validateNpmVersion(version)}.tgz`

/**
 * artifactPayloadFiles adds the target-specific executable to the fixed artifact allowlist.
 *
 * @param {Record<string, string>} contract Native package contract.
 * @returns {string[]} Sorted full tarball allowlist.
 */
export const artifactPayloadFiles = (contract: NativeTarget): string[] =>
  [...ARTIFACT_FILES, contract.payload].sort()
