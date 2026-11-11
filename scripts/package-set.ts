// Imports
// -----------------------------------------------------------------------------
// Node.js
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

// Internal
import { validateLauncherManifest } from '../src/lib/artifacts.js'
import {
  NATIVE_TARGETS,
  nativeTargetByName,
  WASI_TARGET,
} from '../src/lib/targets.js'
import {
  artifactPayloadFiles,
  LAUNCHER_FILES,
  LICENSE_DIGESTS,
  packageDirectory,
  tarballFilename,
} from './package-metadata.js'
import {
  canonicalJSONString,
  sha256,
  validateRelativePath,
} from './product-contract.js'

// Types
import type { NativeTarget } from '../src/lib/types.js'
import type {
  InspectedNpmTarball,
  PackageSetManifest,
  PackageSetRecord,
} from './types.js'

// Constants
// -----------------------------------------------------------------------------

const DIGEST = /^[0-9a-f]{64}$/
const SOURCE_REVISION = /^(?:development|[0-9a-f]{40})$/
const COMMON_DECLARED_FILES = [...Object.keys(LICENSE_DIGESTS), 'README.md']
const LAUNCHER_DECLARED_FILES = [
  'dist/js/',
  'dist/types/',
  'runtime/',
  ...COMMON_DECLARED_FILES,
]

// Types
// -----------------------------------------------------------------------------
interface GeneratedMetadataCandidate {
  main?: unknown
  types?: unknown
  exports?: unknown
  author?: unknown
  bin?: unknown
  bugs?: unknown
  cpu?: unknown
  dependencies?: unknown
  description?: unknown
  engines?: unknown
  files?: unknown
  homepage?: unknown
  license?: unknown
  name?: unknown
  optionalDependencies?: unknown
  os?: unknown
  pannonico?: unknown
  private?: unknown
  publishConfig?: unknown
  repository?: unknown
  type?: unknown
  version?: unknown
}

interface ArtifactMetadataCandidate {
  edition?: unknown
  payload?: unknown
  schema?: unknown
  sha256?: unknown
  sourceRevision?: unknown
  target?: unknown
}

interface PackageRecordCandidate {
  dependencies?: unknown
  directory?: unknown
  edition?: unknown
  filename?: unknown
  files?: unknown
  name?: unknown
  optionalDependencies?: unknown
  private?: unknown
  role?: unknown
  sha256?: unknown
  size?: unknown
  target?: unknown
}

interface PackageSetCandidate {
  distribution?: unknown
  edition?: unknown
  packages?: unknown
  productVersion?: unknown
  sourceRevision?: unknown
}

// Closed tree
// -----------------------------------------------------------------------------

/**
 * assertExactKeys rejects missing or additional fields at package-set v1 boundaries.
 *
 * @param {unknown} value Candidate object.
 * @param {string[]} expected Exact property names.
 * @param {string} label Contract location.
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
    throw new Error(`${label} has unexpected or missing fields`)
  }
}

/**
 * readClosedFile reads a regular package-set member without traversing an internal symlink.
 *
 * @param {string} root Canonical package-set root.
 * @param {string} relative Valid portable path.
 * @returns {Buffer} Exact member bytes.
 */
const readClosedFile = (root: string, relative: string): Buffer => {
  let current = root
  const components = relative.split('/')
  for (const [index, component] of components.entries()) {
    current = path.join(current, component)
    let information
    try {
      information = lstatSync(current)
    } catch (error) {
      throw new Error(`${relative} is missing`, { cause: error })
    }
    if (information.isSymbolicLink())
      throw new Error(`${relative} must not traverse a symlink`)
    if (index < components.length - 1 && !information.isDirectory()) {
      throw new Error(`${relative} contains a non-directory component`)
    }
    if (index === components.length - 1 && !information.isFile()) {
      throw new Error(`${relative} must be a regular file`)
    }
  }
  return readFileSync(current)
}

/**
 * collectTree enumerates one generated package-set tree and rejects special entries.
 *
 * @param {string} root Canonical package-set root.
 * @param {string} relative Portable traversal prefix.
 * @returns {string[]} Sorted regular-file paths.
 */
const collectTree = (root: string, relative = ''): string[] => {
  const directory =
    relative === '' ? root : path.join(root, ...relative.split('/'))
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`
    if (entry.isSymbolicLink())
      throw new Error(`${child} must not be a symlink`)
    if (entry.isDirectory()) files.push(...collectTree(root, child))
    else if (entry.isFile()) files.push(child)
    else throw new Error(`${child} must be a regular file or directory`)
  }
  return files.sort()
}

/**
 * equalRecord compares JSON metadata maps without relying on insertion order.
 *
 * Dependency relationships are canonical contract input. Sorting them before comparison prevents
 * formatter order from changing verification while still requiring exact names and versions.
 *
 * @param {unknown} left First metadata value.
 * @param {unknown} right Second metadata value.
 * @returns {boolean} Whether canonical JSON identities match.
 */
const equalRecord = (left: unknown, right: unknown): boolean =>
  canonicalJSONString(left) === canonicalJSONString(right)

/**
 * readTarString decodes one NUL-terminated ASCII field from a tar header.
 *
 * @param {Buffer} header Complete 512-byte tar header.
 * @param {number} start Field offset.
 * @param {number} length Field length.
 * @returns {string} Decoded field without NUL padding.
 */
const readTarString = (header: Buffer, start: number, length: number): string =>
  header
    .subarray(start, start + length)
    .toString('utf8')
    .replace(/\0.*$/s, '')

/**
 * readTarSize parses the standard octal size field emitted by npm's tar writer.
 *
 * @param {Buffer} header Complete 512-byte tar header.
 * @returns {number} Safe payload byte count.
 */
const readTarSize = (header: Buffer): number => {
  const text = readTarString(header, 124, 12).trim()
  const size = text === '' ? 0 : Number.parseInt(text, 8)
  if (!Number.isSafeInteger(size) || size < 0)
    throw new Error('npm tarball has an invalid size field')
  return size
}

/**
 * validateTarChecksum rejects malformed headers before trusting their paths or sizes.
 *
 * @param {Buffer} header Complete 512-byte tar header.
 * @param {string} label Tarball path for errors.
 */
const validateTarChecksum = (header: Buffer, label: string): void => {
  const stored = Number.parseInt(readTarString(header, 148, 8).trim(), 8)
  let calculated = 0
  for (let index = 0; index < header.length; index += 1) {
    calculated += index >= 148 && index < 156 ? 32 : (header[index] ?? 0)
  }
  if (!Number.isSafeInteger(stored) || stored !== calculated) {
    throw new Error(`${label} contains an invalid tar header checksum`)
  }
}

/**
 * inspectNpmTarball reads npm's gzip-tar output without trusting the adjacent package tree.
 *
 * Only regular files and directories below `package/` are accepted. The returned inventory and
 * package metadata let the verifier catch a swapped or relabeled edition tarball even
 * when an attacker also recomputes the outer digest and set identity.
 *
 * @param {Buffer} compressed Exact `.tgz` bytes.
 * @param {string} label Tarball path for errors.
 * @returns {{contents: Map<string, Buffer>, files: string[], metadata: Record<string, unknown>}} Tarball payload projection.
 */
export const inspectNpmTarball = (
  compressed: Buffer,
  label: string,
): InspectedNpmTarball => {
  let archive
  try {
    archive = gunzipSync(compressed)
  } catch (error) {
    throw new Error(`${label} is not a valid gzip tarball`, { cause: error })
  }
  const contents = new Map<string, Buffer>()
  const files: string[] = []
  let metadata: Record<string, unknown> | undefined
  let offset = 0
  let ended = false
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      ended = true
      break
    }
    validateTarChecksum(header, label)
    const prefix = readTarString(header, 345, 155)
    const name = [prefix, readTarString(header, 0, 100)]
      .filter(Boolean)
      .join('/')
    const size = readTarSize(header)
    const type = String.fromCharCode(header[156] || 48)
    const bodyStart = offset + 512
    const bodyEnd = bodyStart + size
    if (bodyEnd > archive.length)
      throw new Error(`${label} contains a truncated tar entry`)
    if (type !== '0' && type !== '5') {
      throw new Error(
        `${label} contains unsupported tar entry ${JSON.stringify(name)}`,
      )
    }
    if (!name.startsWith('package/')) {
      throw new Error(`${label} contains a path outside package/`)
    }
    const relative = name.slice('package/'.length).replace(/\/$/, '')
    if (relative !== '') validateRelativePath(relative, `${label} entry`)
    if (type === '0') {
      if (files.includes(relative))
        throw new Error(`${label} contains duplicate file ${relative}`)
      files.push(relative)
      contents.set(relative, archive.subarray(bodyStart, bodyEnd))
      if (relative === 'package.json') {
        try {
          metadata = JSON.parse(
            archive.subarray(bodyStart, bodyEnd).toString('utf8'),
          ) as Record<string, unknown>
        } catch (error) {
          throw new Error(`${label} contains invalid package.json`, {
            cause: error,
          })
        }
      }
    }
    offset = bodyStart + Math.ceil(size / 512) * 512
  }
  if (!ended || archive.subarray(offset).some(byte => byte !== 0)) {
    throw new Error(`${label} has invalid data after its tar entries`)
  }
  if (metadata === undefined) throw new Error(`${label} omits package.json`)
  return { contents, files: files.sort(), metadata }
}

/**
 * validateGeneratedMetadata enforces the complete role-specific package.json contract.
 *
 * Package-set verification calls this for both the staged tree and its byte-identical packed
 * metadata. Exact top-level keys prevent lifecycle scripts, alternate executable entrypoints,
 * dependency types, or npm publishing controls from entering a candidate unnoticed.
 * Launcher and artifact branches then validate their complete executable, files, platform, and
 * distribution shapes.
 *
 * @param {Record<string, unknown>} metadata Parsed generated package metadata.
 * @param {Record<string, unknown>} record Validated package-set record.
 * @param {Record<string, unknown>} set Parsed package-set identity.
 * @param {Record<string, string> | undefined} contract Native contract for artifact packages.
 */
const validateGeneratedMetadata = (
  metadataValue: unknown,
  record: PackageSetRecord,
  set: PackageSetManifest,
  contract: NativeTarget | undefined,
): GeneratedMetadataCandidate => {
  const distributionKeys =
    set.distribution === 'development'
      ? ['private']
      : ['bugs', 'homepage', 'publishConfig', 'repository']
  const roleKeys =
    record.role === 'launcher'
      ? [
          'bin',
          'engines',
          'optionalDependencies',
          'type',
          'main',
          'types',
          'exports',
        ]
      : ['cpu', 'os']
  assertExactKeys(
    metadataValue,
    [
      'author',
      'description',
      'files',
      'license',
      'name',
      'pannonico',
      'version',
      ...distributionKeys,
      ...roleKeys,
    ],
    `${record.name} generated metadata`,
  )
  const metadata = metadataValue as GeneratedMetadataCandidate
  if (
    metadata.author !== 'Vladimir Jovanovic' ||
    metadata.license !==
      '(PolyForm-Noncommercial-1.0.0 OR PolyForm-Small-Business-1.0.0)'
  ) {
    throw new Error(
      `${record.name} generated author or license metadata is invalid`,
    )
  }
  if (set.distribution === 'development') {
    if (metadata.private !== true) {
      throw new Error(
        `${record.name} development metadata must be non-publishable`,
      )
    }
  } else if (
    !equalRecord(metadata.publishConfig, {
      access: 'public',
      registry: 'https://registry.npmjs.org',
    }) ||
    metadata.homepage !== 'https://github.com/vx-rs/pannonico' ||
    !equalRecord(metadata.repository, {
      type: 'git',
      url: 'https://github.com/vx-rs/pannonico',
    }) ||
    !equalRecord(metadata.bugs, {
      url: 'https://github.com/vx-rs/pannonico/issues',
    })
  ) {
    throw new Error(
      `${record.name} public metadata must declare the exact public destinations`,
    )
  }
  if (record.role === 'launcher') {
    if (
      metadata.description !==
        'Verified native launcher with bundled WASI fallback for Pannonico' ||
      !equalRecord(metadata.bin, { pannonico: './dist/js/bin/pannonico.js' }) ||
      !equalRecord(metadata.files, LAUNCHER_DECLARED_FILES) ||
      metadata.type !== 'module' ||
      metadata.main !== './dist/js/index.js' ||
      metadata.types !== './dist/types/index.d.ts' ||
      !equalRecord(metadata.exports, {
        '.': { types: './dist/types/index.d.ts', import: './dist/js/index.js' },
      }) ||
      !equalRecord(metadata.engines, { node: '>=24.0.0' })
    ) {
      throw new Error(
        `${record.name} launcher executable or files metadata is invalid`,
      )
    }
    return metadata
  }
  if (
    contract === undefined ||
    metadata.description !==
      `Pannonico ${contract.target} executable artifact` ||
    !equalRecord(metadata.files, [contract.payload, ...COMMON_DECLARED_FILES])
  ) {
    throw new Error(`${record.name} artifact files metadata is invalid`)
  }
  assertExactKeys(
    metadata.pannonico,
    ['edition', 'payload', 'schema', 'sha256', 'sourceRevision', 'target'],
    `${record.name} Pannonico metadata`,
  )
  if (contract.platform !== undefined) {
    if (
      !equalRecord(metadata.os, [contract.platform]) ||
      !equalRecord(metadata.cpu, [contract.architecture])
    ) {
      throw new Error(`${record.name} OS or CPU metadata is invalid`)
    }
  }
  return metadata
}

/**
 * validatePackageRecord verifies one manifest record, package tree, and tarball bytes.
 *
 * @param {string} root Canonical package-set root.
 * @param {unknown} value Package record candidate.
 * @param {Record<string, unknown>} set Parsed set identity.
 * @returns {Record<string, unknown>} Validated record.
 */
const validatePackageRecord = (
  root: string,
  value: unknown,
  set: PackageSetManifest,
): PackageSetRecord => {
  assertExactKeys(
    value,
    [
      'dependencies',
      'directory',
      'edition',
      'filename',
      'files',
      'name',
      'optionalDependencies',
      'private',
      'role',
      'sha256',
      'size',
      'target',
    ],
    'npm package record',
  )
  const candidate = value as PackageRecordCandidate
  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.directory !== 'string' ||
    typeof candidate.filename !== 'string' ||
    typeof candidate.target !== 'string'
  ) {
    throw new Error('npm package record names and paths must be strings')
  }
  validateRelativePath(candidate.directory, 'npm package directory')
  validateRelativePath(candidate.filename, 'npm package tarball path')
  if (
    !candidate.directory.startsWith('packages/') ||
    !candidate.filename.startsWith('tarballs/')
  ) {
    throw new Error('npm package paths must use packages/ and tarballs/')
  }
  if (
    candidate.edition !== set.edition ||
    candidate.private !== (set.distribution === 'development')
  ) {
    throw new Error('npm package edition or privacy does not match its set')
  }
  if (
    typeof candidate.size !== 'number' ||
    !Number.isSafeInteger(candidate.size) ||
    candidate.size <= 0
  ) {
    throw new Error('npm package tarball size is invalid')
  }
  if (typeof candidate.sha256 !== 'string' || !DIGEST.test(candidate.sha256)) {
    throw new Error('npm package tarball digest is invalid')
  }
  if (!Array.isArray(candidate.files) || candidate.files.length === 0) {
    throw new Error('npm package file inventory must be nonempty')
  }
  const files = candidate.files.map(entry =>
    validateRelativePath(entry, 'npm package file'),
  )
  if (
    new Set(files).size !== files.length ||
    [...files].sort().some((entry, index) => entry !== files[index])
  ) {
    throw new Error('npm package file inventory must be sorted and unique')
  }
  if (
    candidate.dependencies === null ||
    typeof candidate.dependencies !== 'object' ||
    Array.isArray(candidate.dependencies) ||
    candidate.optionalDependencies === null ||
    typeof candidate.optionalDependencies !== 'object' ||
    Array.isArray(candidate.optionalDependencies)
  ) {
    throw new Error('npm package dependency metadata must be objects')
  }
  let contract: NativeTarget | undefined
  if (candidate.role === 'launcher') {
    if (candidate.name !== 'pannonico' || candidate.target !== 'launcher') {
      throw new Error('npm package record role, name, or target is invalid')
    }
  } else if (candidate.role === 'native') {
    contract = nativeTargetByName(candidate.target)
    if (
      contract === undefined ||
      contract.packageName !== candidate.name ||
      contract.target !== candidate.target
    ) {
      throw new Error('npm package record role, name, or target is invalid')
    }
  } else {
    throw new Error('npm package record role, name, or target is invalid')
  }
  const expectedFiles =
    candidate.role === 'launcher'
      ? [...LAUNCHER_FILES].sort()
      : artifactPayloadFiles(contract!)
  if (!equalRecord(files, expectedFiles)) {
    throw new Error(
      `${candidate.name} file inventory does not match its explicit package allowlist`,
    )
  }
  if (
    candidate.directory !== `packages/${packageDirectory(candidate.name)}` ||
    candidate.filename !==
      `tarballs/${tarballFilename(candidate.name, set.productVersion)}`
  ) {
    throw new Error(
      `${candidate.name} package directory or tarball filename is invalid`,
    )
  }
  const tarball = readClosedFile(root, candidate.filename)
  if (tarball.length !== candidate.size)
    throw new Error(`${candidate.filename} size mismatch`)
  if (sha256(tarball) !== candidate.sha256)
    throw new Error(`${candidate.filename} digest mismatch`)
  const packed = inspectNpmTarball(tarball, candidate.filename)
  if (!equalRecord(packed.files, files)) {
    throw new Error(
      `${candidate.filename} payload does not match its file inventory`,
    )
  }
  for (const file of files) {
    if (file === 'package.json') continue
    const staged = readClosedFile(root, `${candidate.directory}/${file}`)
    if (!packed.contents.get(file)?.equals(staged)) {
      throw new Error(
        `${candidate.filename} file ${file} differs from its generated package tree`,
      )
    }
  }
  for (const [relative, expectedDigest] of Object.entries(LICENSE_DIGESTS)) {
    const legal = packed.contents.get(relative)
    if (legal === undefined || sha256(legal) !== expectedDigest) {
      throw new Error(`${candidate.filename} legal file ${relative} is invalid`)
    }
  }
  const record: PackageSetRecord = {
    dependencies: candidate.dependencies as Record<string, string>,
    directory: candidate.directory,
    edition: set.edition,
    filename: candidate.filename,
    files,
    name: candidate.name,
    optionalDependencies: candidate.optionalDependencies as Record<
      string,
      string
    >,
    private: set.distribution === 'development',
    role: candidate.role,
    sha256: candidate.sha256,
    size: candidate.size,
    target: candidate.target,
  }
  const metadataPath = `${record.directory}/package.json`
  const metadataValue = JSON.parse(
    readClosedFile(root, metadataPath).toString('utf8'),
  ) as unknown
  const metadata = validateGeneratedMetadata(
    metadataValue,
    record,
    set,
    contract,
  )
  if (
    !equalRecord(packed.metadata, metadata) ||
    metadata.name !== record.name ||
    metadata.version !== set.productVersion ||
    !equalRecord(metadata.dependencies ?? {}, record.dependencies) ||
    !equalRecord(
      metadata.optionalDependencies ?? {},
      record.optionalDependencies,
    )
  ) {
    throw new Error(
      `${record.name} generated metadata does not match its package-set record`,
    )
  }
  if (record.role === 'launcher') {
    const identity = validateLauncherManifest(metadata)
    if (
      identity.edition !== set.edition ||
      identity.sourceRevision !== set.sourceRevision ||
      identity.version !== set.productVersion
    ) {
      throw new Error('npm launcher identity does not match its package set')
    }
    const bundledWasi = packed.contents.get(WASI_TARGET.payload)
    if (
      bundledWasi === undefined ||
      bundledWasi.length !== identity.wasi.size ||
      sha256(bundledWasi) !== identity.wasi.sha256 ||
      identity.wasi.path !== WASI_TARGET.payload ||
      identity.wasi.target !== WASI_TARGET.target
    ) {
      throw new Error(
        'npm launcher bundled WASI identity or payload is invalid',
      )
    }
  } else {
    if (
      metadata.pannonico === null ||
      typeof metadata.pannonico !== 'object' ||
      Array.isArray(metadata.pannonico)
    ) {
      throw new Error(
        `${record.name} artifact identity does not match its package set`,
      )
    }
    const artifact = metadata.pannonico as ArtifactMetadataCandidate
    if (
      artifact.schema !== 'npm-artifact/v1' ||
      artifact.edition !== set.edition ||
      artifact.sourceRevision !== set.sourceRevision ||
      artifact.target !== record.target ||
      typeof artifact.sha256 !== 'string' ||
      contract === undefined
    ) {
      throw new Error(
        `${record.name} artifact identity does not match its package set`,
      )
    }
    const payload = packed.contents.get(contract.payload)
    if (payload === undefined || sha256(payload) !== artifact.sha256) {
      throw new Error(`${record.filename} executable payload digest is invalid`)
    }
  }
  return record
}

// Public verifier
// -----------------------------------------------------------------------------

/**
 * verifyPackageSet validates the npm package manifest and complete output tree.
 *
 * Offline installation and root release collection call this boundary before using tarballs. The
 * manifest binds package identities, dependencies, allowlists, sizes, and digests, while the closed
 * tree check rejects missing or unlisted package files and tarballs.
 *
 * @param {string} manifestPath Explicit npm package-set manifest path.
 * @param {{expectedEdition?: "free" | "pro"}} options Optional caller expectation.
 * @returns {Record<string, unknown>} Verified manifest.
 */
export const verifyPackageSet = (
  manifestPath: string,
  options: {
    expectedEdition?: 'free' | 'pro' | undefined
  } = {},
): PackageSetManifest => {
  const suppliedManifest = path.resolve(manifestPath)
  const information = lstatSync(suppliedManifest)
  if (information.isSymbolicLink() || !information.isFile()) {
    throw new Error(
      'npm package-set manifest must be a regular non-symlink file',
    )
  }
  const root = realpathSync.native(path.dirname(suppliedManifest))
  const bytes = readClosedFile(root, path.basename(suppliedManifest))
  let manifest
  try {
    manifest = JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error('npm package-set manifest is not valid JSON', {
      cause: error,
    })
  }
  assertExactKeys(
    manifest,
    ['distribution', 'edition', 'packages', 'productVersion', 'sourceRevision'],
    'npm package-set manifest',
  )
  const candidate = manifest as PackageSetCandidate
  if (candidate.edition !== 'free' && candidate.edition !== 'pro') {
    throw new Error('npm package-set edition is invalid')
  }
  if (
    options.expectedEdition !== undefined &&
    candidate.edition !== options.expectedEdition
  ) {
    throw new Error(
      `npm package-set edition is ${candidate.edition}, expected ${options.expectedEdition}`,
    )
  }
  if (
    (candidate.distribution !== 'public' &&
      candidate.distribution !== 'development') ||
    (candidate.distribution === 'public' && candidate.edition !== 'free')
  ) {
    throw new Error('npm package-set distribution is invalid for its edition')
  }
  if (
    typeof candidate.sourceRevision !== 'string' ||
    !SOURCE_REVISION.test(candidate.sourceRevision)
  ) {
    throw new Error('npm package-set source revision is invalid')
  }
  if (typeof candidate.productVersion !== 'string') {
    throw new Error('npm package-set product version is invalid')
  }
  if (!Array.isArray(candidate.packages) || candidate.packages.length < 2) {
    throw new Error('npm package-set must contain launcher and native packages')
  }
  const set: PackageSetManifest = {
    distribution: candidate.distribution,
    edition: candidate.edition,
    packages: [],
    productVersion: candidate.productVersion,
    sourceRevision: candidate.sourceRevision,
  }
  const packages = candidate.packages.map(record =>
    validatePackageRecord(root, record, set),
  )
  set.packages = packages
  if (new Set(packages.map(record => record.name)).size !== packages.length) {
    throw new Error('npm package-set contains duplicate package names')
  }
  if (
    packages.filter(record => record.role === 'launcher').length !== 1 ||
    packages.filter(record => record.role === 'native').length < 1
  ) {
    throw new Error('npm package-set roles are incomplete or duplicated')
  }
  const launcher = packages.find(record => record.role === 'launcher')
  const native = packages.filter(record => record.role === 'native')
  if (launcher === undefined) {
    throw new Error('npm package-set launcher record is missing')
  }
  const orderedNames = [
    launcher.name,
    ...native.map(record => record.name).sort(),
  ]
  if (packages.some((record, index) => record.name !== orderedNames[index])) {
    throw new Error(
      'npm package-set records must contain launcher then sorted native packages',
    )
  }
  if (Object.keys(launcher.dependencies).length > 0) {
    throw new Error(
      'npm launcher must not declare required package dependencies',
    )
  }
  if (
    !equalRecord(
      launcher.optionalDependencies,
      Object.fromEntries(
        native.map(record => [record.name, set.productVersion]),
      ),
    )
  ) {
    throw new Error(
      'npm launcher optional dependencies do not match native packages',
    )
  }
  for (const artifact of native) {
    if (
      Object.keys(artifact.dependencies).length > 0 ||
      Object.keys(artifact.optionalDependencies).length > 0
    ) {
      throw new Error(`${artifact.name} must not declare package dependencies`)
    }
  }
  if (
    set.sourceRevision !== 'development' &&
    !equalRecord(
      native.map(record => record.name).sort(),
      NATIVE_TARGETS.map(contract => contract.packageName).sort(),
    )
  ) {
    throw new Error(
      'release npm package-set must contain the complete six-package native matrix',
    )
  }
  const expectedFiles = new Set(['manifest.json'])
  for (const record of packages) {
    expectedFiles.add(record.filename)
    for (const file of record.files)
      expectedFiles.add(`${record.directory}/${file}`)
  }
  const actualFiles = collectTree(root)
  const additional = actualFiles.filter(entry => !expectedFiles.has(entry))
  const missing = [...expectedFiles].filter(
    entry => !actualFiles.includes(entry),
  )
  if (additional.length > 0 || missing.length > 0) {
    throw new Error(
      `npm package-set tree is not closed: additional=${additional.join(',')} missing=${missing.join(',')}`,
    )
  }
  return set
}
