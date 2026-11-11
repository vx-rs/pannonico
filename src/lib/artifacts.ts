// Imports
// -----------------------------------------------------------------------------
// Node.js
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Internal
import { WASI_TARGET } from './targets.js'

// Types
import type {
  BundledWasiIdentity,
  LauncherIdentity,
  NativeTarget,
} from './types.js'

// Constants
// -----------------------------------------------------------------------------

const DIGEST = /^[0-9a-f]{64}$/
const SOURCE_REVISION = /^(?:development|[0-9a-f]{40})$/
const PACKAGE_VERSION =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
const LAUNCHER_MANIFEST = fileURLToPath(
  new URL('../../../package.json', import.meta.url),
)

// Types
// -----------------------------------------------------------------------------
interface BundledWasiCandidate {
  path?: unknown
  sha256?: unknown
  size?: unknown
  target?: unknown
}

interface LauncherPannonicoCandidate {
  edition?: unknown
  schema?: unknown
  sourceRevision?: unknown
  wasi?: unknown
}

interface PackageMetadataCandidate {
  bin?: unknown
  cpu?: unknown
  dependencies?: unknown
  name?: unknown
  optionalDependencies?: unknown
  os?: unknown
  pannonico?: unknown
  private?: unknown
  publishConfig?: unknown
  scripts?: unknown
  version?: unknown
}

interface ArtifactIdentityCandidate {
  edition?: unknown
  payload?: unknown
  schema?: unknown
  sha256?: unknown
  sourceRevision?: unknown
  target?: unknown
}

interface ValidatedArtifactManifest {
  pannonico: { sha256: string }
}

// Errors
// -----------------------------------------------------------------------------

/**
 * PackageUnavailableError identifies only an absent optional native package.
 *
 * The launcher catches this specific type to enter WASI fallback. Malformed metadata, wrong
 * versions or editions, unsafe payloads, and checksum failures remain hard errors.
 */
export class PackageUnavailableError extends Error {
  readonly packageName: string

  /**
   * constructor preserves the unresolved package name for actionable fallback diagnostics.
   *
   * @param {string} packageName Exact package that normal Node resolution could not find.
   * @param {unknown} cause Original resolution error.
   */
  constructor(packageName: string, cause: unknown) {
    super(`Package ${packageName} is not installed`, { cause })
    this.name = 'PackageUnavailableError'
    this.packageName = packageName
  }
}

// Validation
// -----------------------------------------------------------------------------

/**
 * assertExactKeys keeps generated package identity records closed at runtime.
 *
 * Package metadata is executable selection input. Rejecting extensions prevents a future producer
 * from assigning meaning that the installed launcher silently ignores.
 *
 * @param {unknown} value Candidate object.
 * @param {string[]} expected Exact property names.
 * @param {string} label Error context.
 */
const assertExactKeys: (
  value: unknown,
  expected: ReadonlyArray<string>,
  label: string,
) => asserts value is Record<string, unknown> = (value, expected, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new Error(`${label} must contain exactly ${wanted.join(', ')}`)
  }
}

/**
 * readRegularFile returns one package-owned file without following a final symlink.
 *
 * npm tarball installs create regular package files. Refusing symlinks keeps metadata and payload
 * verification bound to the installed bytes rather than an external mutable target.
 *
 * @param {string} filePath Absolute file path.
 * @param {string} label Error context.
 * @returns {Buffer} Exact file bytes.
 */
const readRegularFile = (filePath: string, label: string): Buffer => {
  let information
  try {
    information = lstatSync(filePath)
  } catch (error) {
    throw new Error(`${label} is missing`, { cause: error })
  }
  if (information.isSymbolicLink() || !information.isFile()) {
    throw new Error(`${label} must be a regular non-symlink file`)
  }
  return readFileSync(filePath)
}

/**
 * parseJSONFile reads one verified regular file and reports parse errors with package context.
 *
 * @param {string} filePath Absolute JSON path.
 * @param {string} label Error context.
 * @returns {Record<string, unknown>} Parsed JSON object candidate.
 */
const parseJSONFile = (filePath: string, label: string): unknown => {
  try {
    return JSON.parse(readRegularFile(filePath, label).toString('utf8'))
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} is not valid JSON`, { cause: error })
    }
    throw error
  }
}

/**
 * readPackageLocalFile reads an installed-package-owned payload without traversing internal symlinks.
 *
 * Bundled WASI and native package verification use this boundary instead of a final-file-only
 * check. Every relative component must remain inside its resolved package and must have the expected
 * directory or file type, preventing replaced `runtime` or `bin` directories from redirecting
 * checksum-identical payload bytes to mutable external storage.
 *
 * @param {string} packageRoot Absolute resolved launcher or native package directory.
 * @param {string} relativePath Closed forward-slash package path.
 * @param {string} label Error context.
 * @returns {{bytes: Buffer, path: string}} Exact payload bytes and native filesystem path.
 */
const readPackageLocalFile = (
  packageRoot: string,
  relativePath: string,
  label: string,
): { bytes: Buffer; path: string } => {
  let current = packageRoot
  const components = relativePath.split('/')
  for (const [index, component] of components.entries()) {
    current = path.join(current, component)
    let information
    try {
      information = lstatSync(current)
    } catch (error) {
      throw new Error(`${label} is missing`, { cause: error })
    }
    if (information.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symlink`)
    }
    if (index < components.length - 1 && !information.isDirectory()) {
      throw new Error(`${label} contains a non-directory component`)
    }
    if (index === components.length - 1 && !information.isFile()) {
      throw new Error(`${label} must be a regular file`)
    }
  }
  return { bytes: readFileSync(current), path: current }
}

/**
 * isPackageVersion accepts the exact SemVer subset emitted by package construction.
 *
 * Numeric prerelease identifiers may not contain leading zeroes. Build metadata is deliberately
 * excluded because the generated dependency graph must preserve one exact npm version string.
 *
 * @param {unknown} value Package version candidate.
 * @returns {boolean} Whether the value is valid for installed package identity.
 */
const isPackageVersion = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  const match = PACKAGE_VERSION.exec(value)
  return (
    match !== null &&
    (match[4] === undefined ||
      match[4].split('.').every(part => !/^0[0-9]+$/.test(part)))
  )
}

/**
 * validateBundledWasiIdentity keeps the launcher-local fallback record closed and immutable.
 *
 * Both manifest parsing and direct payload verification call this boundary. Requiring the one
 * package-owned path prevents traversal or alternate runtime selection, while size and digest bind
 * execution to the Go-produced bytes copied during package construction.
 *
 * @param {unknown} value Bundled WASI identity candidate.
 * @returns {{path: string, sha256: string, size: number, target: string}} Validated identity.
 */
const validateBundledWasiIdentity = (value: unknown): BundledWasiIdentity => {
  assertExactKeys(
    value,
    ['path', 'sha256', 'size', 'target'],
    'bundled WASI metadata',
  )
  const identity = value as BundledWasiCandidate
  if (
    identity.path !== WASI_TARGET.payload ||
    identity.target !== WASI_TARGET.target ||
    typeof identity.sha256 !== 'string' ||
    !DIGEST.test(identity.sha256) ||
    typeof identity.size !== 'number' ||
    !Number.isSafeInteger(identity.size) ||
    identity.size <= 0
  ) {
    throw new Error('bundled WASI path, target, size, or digest is invalid')
  }
  return {
    path: identity.path,
    sha256: identity.sha256,
    size: identity.size,
    target: identity.target,
  }
}

/**
 * validateLauncherManifest extracts the immutable identity that every executable package must match.
 *
 * Generated Free and development Pro launchers use the same runtime code. Edition comes only from
 * package metadata, so no environment variable or hidden runtime flag can select Pro bytes.
 *
 * @param {unknown} value Parsed launcher package metadata.
 * @returns {{edition: "free" | "pro", sourceRevision: string, version: string, wasi: {path: string, sha256: string, size: number, target: string}}} Runtime identity.
 */
export const validateLauncherManifest = (value: unknown): LauncherIdentity => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('launcher metadata must be an object')
  }
  const metadata = value as PackageMetadataCandidate
  if (metadata.name !== 'pannonico')
    throw new Error('launcher package name must be pannonico')
  if (!isPackageVersion(metadata.version)) {
    throw new Error('launcher package version is invalid')
  }
  const pannonicoValue = metadata.pannonico
  assertExactKeys(
    pannonicoValue,
    ['edition', 'schema', 'sourceRevision', 'wasi'],
    'launcher Pannonico metadata',
  )
  const pannonico = pannonicoValue as LauncherPannonicoCandidate
  if (pannonico.schema !== 'npm-launcher/v2') {
    throw new Error('launcher Pannonico schema must be npm-launcher/v2')
  }
  if (pannonico.edition !== 'free' && pannonico.edition !== 'pro') {
    throw new Error('launcher Pannonico edition must be free or pro')
  }
  if (
    typeof pannonico.sourceRevision !== 'string' ||
    !SOURCE_REVISION.test(pannonico.sourceRevision)
  ) {
    throw new Error('launcher Pannonico source revision is invalid')
  }
  const wasi = validateBundledWasiIdentity(pannonico.wasi)
  if (pannonico.edition === 'pro') {
    if (metadata.private !== true || metadata.publishConfig !== undefined) {
      throw new Error(
        'development Pro launcher must be private and have no publish configuration',
      )
    }
  } else if (metadata.private !== undefined) {
    throw new Error('public Free launcher must not be private')
  }
  return {
    edition: pannonico.edition,
    sourceRevision: pannonico.sourceRevision,
    version: metadata.version,
    wasi: { ...wasi },
  }
}

/**
 * validateArtifactManifest proves that one resolved package belongs to the launcher product set.
 *
 * Exact name, version, edition, source revision, target, payload, and platform restrictions prevent
 * npm from combining independently valid packages from different builds or editions.
 *
 * @param {Record<string, unknown>} value Parsed artifact package metadata.
 * @param {Record<string, string>} contract Declared native package contract.
 * @param {{edition: "free" | "pro", sourceRevision: string, version: string}} launcher Launcher identity.
 */
const validateArtifactManifest = (
  value: unknown,
  contract: NativeTarget,
  launcher: LauncherIdentity,
): ValidatedArtifactManifest => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${contract.packageName} metadata must be an object`)
  }
  const metadata = value as PackageMetadataCandidate
  if (metadata.name !== contract.packageName) {
    throw new Error(`${contract.packageName} package name is invalid`)
  }
  if (metadata.version !== launcher.version) {
    throw new Error(
      `${contract.packageName} version ${JSON.stringify(metadata.version)} does not match launcher ${launcher.version}`,
    )
  }
  if (
    metadata.scripts !== undefined ||
    metadata.dependencies !== undefined ||
    metadata.optionalDependencies !== undefined ||
    metadata.bin !== undefined
  ) {
    throw new Error(
      `${contract.packageName} must not declare scripts, executables, or dependencies`,
    )
  }
  const pannonicoValue = metadata.pannonico
  assertExactKeys(
    pannonicoValue,
    ['edition', 'payload', 'schema', 'sha256', 'sourceRevision', 'target'],
    `${contract.packageName} Pannonico metadata`,
  )
  const identity = pannonicoValue as ArtifactIdentityCandidate
  if (
    identity.schema !== 'npm-artifact/v1' ||
    identity.edition !== launcher.edition ||
    identity.sourceRevision !== launcher.sourceRevision ||
    identity.target !== contract.target ||
    identity.payload !== contract.payload ||
    typeof identity.sha256 !== 'string' ||
    !DIGEST.test(identity.sha256)
  ) {
    throw new Error(
      `${contract.packageName} Pannonico edition, revision, target, payload, or digest is invalid`,
    )
  }
  if (launcher.edition === 'pro') {
    if (metadata.private !== true || metadata.publishConfig !== undefined) {
      throw new Error(
        `${contract.packageName} development Pro metadata must be non-publishable`,
      )
    }
  } else if (metadata.private !== undefined) {
    throw new Error(
      `${contract.packageName} public Free metadata must not be private`,
    )
  }
  if (contract.platform !== undefined) {
    if (
      !Array.isArray(metadata.os) ||
      metadata.os.length !== 1 ||
      metadata.os[0] !== contract.platform ||
      !Array.isArray(metadata.cpu) ||
      metadata.cpu.length !== 1 ||
      metadata.cpu[0] !== contract.architecture
    ) {
      throw new Error(`${contract.packageName} OS or CPU metadata is invalid`)
    }
  }
  return { pannonico: { sha256: identity.sha256 } }
}

// Public API
// -----------------------------------------------------------------------------

/**
 * readLauncherIdentity reads the generated package metadata beside the installed runtime.
 *
 * Normal CLI execution uses this module-relative path. Focused tests may supply parsed metadata to
 * `main`, but there is no environment-controlled identity or artifact-root override in production.
 *
 * @param {string} manifestPath Module-relative launcher manifest path.
 * @returns {{edition: "free" | "pro", sourceRevision: string, version: string, wasi: {path: string, sha256: string, size: number, target: string}}} Runtime identity.
 */
export const readLauncherIdentity = (
  manifestPath: string = LAUNCHER_MANIFEST,
): LauncherIdentity =>
  validateLauncherManifest(parseJSONFile(manifestPath, 'launcher metadata'))

/**
 * verifyBundledWasi verifies the launcher-local portable runtime before compilation.
 *
 * Normal execution resolves the payload beside this module's package manifest. Focused tests may
 * provide another manifest path, but metadata must still name the one closed runtime path. Missing,
 * redirected, wrong-size, or corrupt bytes are hard failures and never fall through to another
 * artifact source.
 *
 * @param {{edition: "free" | "pro", sourceRevision: string, version: string, wasi: {path: string, sha256: string, size: number, target: string}}} launcher Validated launcher identity.
 * @param {{launcherManifestPath?: string}} options Focused-test manifest location override.
 * @returns {string} Verified package-local WASI path.
 */
export const verifyBundledWasi = (
  launcher: LauncherIdentity,
  options: { launcherManifestPath?: string | undefined } = {},
): string => {
  const identity = validateBundledWasiIdentity(launcher.wasi)
  const manifestPath = path.resolve(
    options.launcherManifestPath ?? LAUNCHER_MANIFEST,
  )
  readRegularFile(manifestPath, 'launcher metadata')
  const payload = readPackageLocalFile(
    path.dirname(manifestPath),
    identity.path,
    'bundled WASI payload',
  )
  if (payload.bytes.length !== identity.size) {
    throw new Error('bundled WASI payload size mismatch')
  }
  if (
    createHash('sha256').update(payload.bytes).digest('hex') !== identity.sha256
  ) {
    throw new Error('bundled WASI payload checksum mismatch')
  }
  return payload.path
}

/**
 * verifyInstalledPackage resolves and verifies one exact-version executable package before use.
 *
 * The default resolver is ordinary Node package resolution from the installed launcher. Only a
 * resolution miss becomes `PackageUnavailableError`; installed integrity failures never trigger
 * automatic fallback. Every payload path component beneath the resolved package directory must be
 * a package-local non-symlink entry. Tests may inject a resolver without changing production
 * discovery.
 *
 * @param {Record<string, string>} contract Declared native package contract.
 * @param {{edition: "free" | "pro", sourceRevision: string, version: string}} launcher Launcher identity.
 * @param {{resolvePackage?: (request: string) => string}} options Focused-test resolver override.
 * @returns {string} Verified payload path.
 */
export const verifyInstalledPackage = (
  contract: NativeTarget,
  launcher: LauncherIdentity,
  options: { resolvePackage?: ((request: string) => string) | undefined } = {},
): string => {
  const resolvePackage =
    options.resolvePackage ??
    ((request: string) => fileURLToPath(import.meta.resolve(request)))
  let manifestPath
  try {
    manifestPath = resolvePackage(`${contract.packageName}/package.json`)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND'
    ) {
      throw new PackageUnavailableError(contract.packageName, error)
    }
    throw new Error(
      `Could not resolve installed package ${contract.packageName}`,
      {
        cause: error,
      },
    )
  }
  const manifest = validateArtifactManifest(
    parseJSONFile(manifestPath, `${contract.packageName} metadata`),
    contract,
    launcher,
  )
  const payload = readPackageLocalFile(
    path.dirname(manifestPath),
    contract.payload,
    `${contract.packageName} payload`,
  )
  if (
    contract.platform !== undefined &&
    contract.platform !== 'win32' &&
    (lstatSync(payload.path).mode & 0o111) === 0
  ) {
    throw new Error(`${contract.packageName} payload is not executable`)
  }
  const digest = createHash('sha256').update(payload.bytes).digest('hex')
  if (digest !== manifest.pannonico.sha256) {
    throw new Error(`${contract.packageName} payload checksum mismatch`)
  }
  return payload.path
}
