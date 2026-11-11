// Imports
// -----------------------------------------------------------------------------
// Node.js
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'

// Internal
import { NATIVE_TARGETS, nativeTargetByName } from '../src/lib/targets.js'

// Types
import type { Edition } from '../src/lib/types.js'
import type { ProductMember, ProductPair, ProductSet } from './types.js'

// Constants
// -----------------------------------------------------------------------------

const DIGEST = /^[0-9a-f]{64}$/
const SOURCE_REVISION = /^(?:development|[0-9a-f]{40})$/
const PRODUCT_VERSION = /^[!-~]+$/

// Types
// -----------------------------------------------------------------------------
interface PlatformCandidate {
  arch?: unknown
  os?: unknown
  target?: unknown
}

interface MemberCandidate {
  executable?: unknown
  kind?: unknown
  path?: unknown
  sha256?: unknown
  size?: unknown
  target?: unknown
}

interface PairReferenceCandidate {
  edition?: unknown
  pairId?: unknown
  path?: unknown
  platform?: unknown
  sha256?: unknown
  size?: unknown
  target?: unknown
}

interface PairManifestCandidate {
  artifacts?: unknown
  edition?: unknown
  pairId?: unknown
  platform?: unknown
  product?: unknown
  productVersion?: unknown
  schema?: unknown
  sourceRevision?: unknown
}

interface ProductSetManifestCandidate {
  editions?: unknown
  pairs?: unknown
  platforms?: unknown
  product?: unknown
  productVersion?: unknown
  schema?: unknown
  setId?: unknown
  sourceRevision?: unknown
}

interface CLIArtifactCandidate {
  executable?: unknown
  filename?: unknown
  sha256?: unknown
  size?: unknown
}

interface CLIManifestCandidate {
  artifacts?: unknown
  edition?: unknown
  product?: unknown
  schema?: unknown
  sourceRevision?: unknown
  version?: unknown
}

// Canonical metadata
// -----------------------------------------------------------------------------

/**
 * canonicalJSONString reproduces the Go artifact producer's v1 identity serialization.
 *
 * Object keys sort recursively while array order remains contract-significant. JavaScript's JSON
 * escaping matches the producer's HTML-escaping-disabled encoder for all accepted version bytes.
 *
 * @param {unknown} value JSON-compatible value.
 * @returns {string} Compact canonical JSON text.
 */
export const canonicalJSONString = (value: unknown): string => {
  if (Array.isArray(value))
    return `[${value.map(canonicalJSONString).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJSONString(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) as string
}

/**
 * sha256 returns the lowercase digest used by every staged contract boundary.
 *
 * @param {string | Uint8Array} value Exact bytes or UTF-8 text.
 * @returns {string} Lowercase SHA-256 digest.
 */
export const sha256 = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex')

// Filesystem validation
// -----------------------------------------------------------------------------

/**
 * assertExactKeys rejects missing or additional fields in a closed v1 object.
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
 * validateRelativePath accepts one normalized portable path from a Go manifest.
 *
 * @param {unknown} value Path candidate.
 * @param {string} label Contract location.
 * @returns {string} Valid forward-slash relative path.
 */
export const validateRelativePath = (value: unknown, label: string): string => {
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    path.win32.parse(value).root !== '' ||
    path.posix.normalize(value) !== value ||
    value.split('/').some(part => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`${label} must be a normalized relative path`)
  }
  return value
}

/**
 * readClosedFile reads one regular member without traversing a set-internal symlink.
 *
 * The product root is canonicalized once so platform aliases outside the set do not create false
 * positives. Every manifest-authored component below that root must be a real directory or file.
 *
 * @param {string} root Canonical product-set root.
 * @param {string} relative Valid portable relative path.
 * @param {{executable?: boolean}} requirements Expected POSIX execute mode.
 * @returns {{bytes: Buffer, mode: number}} Exact bytes and filesystem mode.
 */
const readClosedFile = (
  root: string,
  relative: string,
  requirements: { executable?: boolean | undefined } = {},
): { bytes: Buffer; mode: number } => {
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
  const information = lstatSync(current)
  if (
    process.platform !== 'win32' &&
    requirements.executable === true &&
    (information.mode & 0o111) === 0
  ) {
    throw new Error(`${relative} must be executable`)
  }
  if (
    process.platform !== 'win32' &&
    requirements.executable === false &&
    (information.mode & 0o111) !== 0
  ) {
    throw new Error(`${relative} must not be executable`)
  }
  return { bytes: readFileSync(current), mode: information.mode }
}

/**
 * collectTree enumerates the complete product-set tree and rejects nonregular entries.
 *
 * @param {string} root Canonical product-set root.
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
 * parseClosedJSON parses previously verified manifest bytes with a stable error label.
 *
 * @param {Buffer} bytes Exact manifest bytes.
 * @param {string} label Contract location.
 * @returns {Record<string, unknown>} Parsed object candidate.
 */
const parseClosedJSON = (bytes: Buffer, label: string): unknown => {
  try {
    return JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new Error(`${label} is not valid JSON`, { cause: error })
  }
}

// Pair validation
// -----------------------------------------------------------------------------

/**
 * validateMember verifies one closed product-pair member and returns its package input bytes.
 *
 * @param {unknown} value Member record candidate.
 * @param {"native" | "wasi"} kind Required record position.
 * @param {string} pairRoot Canonical pair directory.
 * @param {string} nativeTarget Pair target.
 * @returns {{bytes: Buffer, executable: boolean, kind: string, path: string, sha256: string, size: number, target: string}} Verified member.
 */
const validateMember = (
  value: unknown,
  kind: 'native' | 'wasi',
  pairRoot: string,
  nativeTarget: string,
): ProductMember => {
  assertExactKeys(
    value,
    ['executable', 'kind', 'path', 'sha256', 'size', 'target'],
    `${kind} member`,
  )
  const member = value as MemberCandidate
  const expectedPath =
    kind === 'native'
      ? nativeTarget.startsWith('windows-')
        ? 'native/pannonico.exe'
        : 'native/pannonico'
      : 'pannonico.wasm'
  const expectedTarget = kind === 'native' ? nativeTarget : 'wasip1-wasm'
  if (
    member.kind !== kind ||
    member.path !== expectedPath ||
    member.target !== expectedTarget
  ) {
    throw new Error(`${kind} member kind, path, or target is invalid`)
  }
  if (member.executable !== (kind === 'native')) {
    throw new Error(`${kind} member executable flag is invalid`)
  }
  if (
    typeof member.size !== 'number' ||
    !Number.isSafeInteger(member.size) ||
    member.size <= 0
  ) {
    throw new Error(`${kind} member size is invalid`)
  }
  if (typeof member.sha256 !== 'string' || !DIGEST.test(member.sha256)) {
    throw new Error(`${kind} member digest is invalid`)
  }
  const relative = validateRelativePath(member.path, `${kind} member path`)
  const { bytes } = readClosedFile(pairRoot, relative, {
    executable: member.executable,
  })
  if (bytes.length !== member.size)
    throw new Error(`${kind} member size mismatch`)
  if (sha256(bytes) !== member.sha256)
    throw new Error(`${kind} member digest mismatch`)
  return {
    bytes,
    executable: member.executable,
    kind,
    path: relative,
    sha256: member.sha256,
    size: member.size,
    target: member.target as string,
  }
}

/**
 * validatePair verifies a product-pair manifest, its canonical identity, and both exact members.
 *
 * @param {string} productRoot Canonical product-set root.
 * @param {Record<string, unknown>} reference Validated set reference candidate.
 * @param {{productVersion: string, sourceRevision: string}} setIdentity Parent identity.
 * @returns {{edition: "free" | "pro", manifestBytes: Buffer, native: Record<string, unknown>, pairId: string, target: string, wasi: Record<string, unknown>}} Verified pair projection.
 */
const validatePair = (
  productRoot: string,
  referenceValue: unknown,
  setIdentity: { productVersion: string; sourceRevision: string },
): ProductPair => {
  assertExactKeys(
    referenceValue,
    ['edition', 'pairId', 'path', 'platform', 'sha256', 'size', 'target'],
    'product-set pair reference',
  )
  const reference = referenceValue as PairReferenceCandidate
  if (reference.edition !== 'free' && reference.edition !== 'pro') {
    throw new Error('product-set pair edition is invalid')
  }
  if (typeof reference.target !== 'string') {
    throw new Error('product-set pair target is invalid')
  }
  const contract = nativeTargetByName(reference.target)
  if (contract === undefined)
    throw new Error(`product-set target ${reference.target} is unsupported`)
  assertExactKeys(
    reference.platform,
    ['arch', 'os'],
    'product-set pair platform',
  )
  const platform = reference.platform as PlatformCandidate
  const expectedOS = reference.target.split('-')[0]
  const expectedArch = reference.target.split('-')[1]
  if (platform.os !== expectedOS || platform.arch !== expectedArch) {
    throw new Error('product-set pair platform does not match its target')
  }
  const expectedPath = `${reference.edition}/${reference.target}/manifest.json`
  if (
    validateRelativePath(reference.path, 'product-set pair path') !==
    expectedPath
  ) {
    throw new Error(
      'product-set pair path does not match its edition and target',
    )
  }
  if (
    typeof reference.size !== 'number' ||
    !Number.isSafeInteger(reference.size) ||
    reference.size <= 0
  ) {
    throw new Error('product-set pair manifest size is invalid')
  }
  if (
    typeof reference.sha256 !== 'string' ||
    !DIGEST.test(reference.sha256) ||
    typeof reference.pairId !== 'string' ||
    !DIGEST.test(reference.pairId)
  ) {
    throw new Error('product-set pair digest or identity is invalid')
  }
  const referencePath = validateRelativePath(
    reference.path,
    'product-set pair path',
  )
  const manifestBytes = readClosedFile(productRoot, referencePath).bytes
  if (manifestBytes.length !== reference.size)
    throw new Error(`${reference.path} size mismatch`)
  if (sha256(manifestBytes) !== reference.sha256) {
    throw new Error(`${reference.path} digest mismatch`)
  }
  const manifestValue = parseClosedJSON(manifestBytes, referencePath)
  assertExactKeys(
    manifestValue,
    [
      'artifacts',
      'edition',
      'pairId',
      'platform',
      'product',
      'productVersion',
      'schema',
      'sourceRevision',
    ],
    'product-pair manifest',
  )
  const manifest = manifestValue as PairManifestCandidate
  if (
    manifest.schema !== 'product-pair/v1' ||
    manifest.product !== 'pannonico'
  ) {
    throw new Error('product-pair schema or product is invalid')
  }
  if (
    manifest.productVersion !== setIdentity.productVersion ||
    manifest.sourceRevision !== setIdentity.sourceRevision ||
    manifest.edition !== reference.edition ||
    manifest.pairId !== reference.pairId
  ) {
    throw new Error('product-pair identity does not match its set reference')
  }
  assertExactKeys(manifest.platform, ['arch', 'os'], 'product-pair platform')
  const manifestPlatform = manifest.platform as PlatformCandidate
  if (
    manifestPlatform.os !== platform.os ||
    manifestPlatform.arch !== platform.arch
  ) {
    throw new Error('product-pair platform does not match its set reference')
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 2) {
    throw new Error('product-pair artifacts must contain native then WASI')
  }
  const identity: Record<string, unknown> = { ...manifest }
  delete identity['pairId']
  if (sha256(canonicalJSONString(identity)) !== manifest.pairId) {
    throw new Error('product-pair pairId mismatch')
  }
  const pairRoot = path.dirname(
    path.join(productRoot, ...referencePath.split('/')),
  )
  return {
    edition: reference.edition,
    manifestBytes,
    native: validateMember(
      manifest.artifacts[0],
      'native',
      pairRoot,
      reference.target,
    ),
    pairId: manifest.pairId,
    target: reference.target,
    wasi: validateMember(
      manifest.artifacts[1],
      'wasi',
      pairRoot,
      reference.target,
    ),
  }
}

// Public consumer
// -----------------------------------------------------------------------------

/**
 * loadProductSet independently verifies a complete closed `product-set/v1` tree.
 *
 * Every declared edition/platform pair and every byte is checked before one edition is returned to
 * npm construction. The selected edition's WASI members must be byte-identical so a single required
 * portable package cannot hide target-dependent producer output.
 *
 * @param {string} manifestPath Explicit product-set manifest path.
 * @param {"free" | "pro"} expectedEdition Edition selected for packaging.
 * @returns {{edition: "free" | "pro", editions: string[], pairs: Record<string, unknown>[], productRoot: string, productVersion: string, setId: string, sourceRevision: string, wasi: Record<string, unknown>}} Verified package input.
 */
export const loadProductSet = (
  manifestPath: string,
  expectedEdition: Edition,
): ProductSet => {
  if (expectedEdition !== 'free' && expectedEdition !== 'pro') {
    throw new Error('expected edition must be free or pro')
  }
  const suppliedManifest = path.resolve(manifestPath)
  const manifestInformation = lstatSync(suppliedManifest)
  if (manifestInformation.isSymbolicLink() || !manifestInformation.isFile()) {
    throw new Error('product-set manifest must be a regular non-symlink file')
  }
  const productRoot = realpathSync.native(path.dirname(suppliedManifest))
  const manifestBytes = readClosedFile(
    productRoot,
    path.basename(suppliedManifest),
  ).bytes
  const manifestValue = parseClosedJSON(manifestBytes, 'product-set manifest')
  assertExactKeys(
    manifestValue,
    [
      'editions',
      'pairs',
      'platforms',
      'product',
      'productVersion',
      'schema',
      'setId',
      'sourceRevision',
    ],
    'product-set manifest',
  )
  const manifest = manifestValue as ProductSetManifestCandidate
  if (
    manifest.schema !== 'product-set/v1' ||
    manifest.product !== 'pannonico'
  ) {
    throw new Error('product-set schema or product is invalid')
  }
  if (
    typeof manifest.productVersion !== 'string' ||
    !PRODUCT_VERSION.test(manifest.productVersion)
  ) {
    throw new Error('product-set version is invalid')
  }
  if (
    typeof manifest.sourceRevision !== 'string' ||
    !SOURCE_REVISION.test(manifest.sourceRevision)
  ) {
    throw new Error('product-set source revision is invalid')
  }
  const editionValues = manifest.editions
  if (
    !Array.isArray(editionValues) ||
    editionValues.length === 0 ||
    editionValues.some(edition => edition !== 'free' && edition !== 'pro') ||
    new Set(editionValues).size !== editionValues.length ||
    [...editionValues]
      .sort()
      .some((edition, index) => edition !== editionValues[index])
  ) {
    throw new Error(
      'product-set editions must be a sorted unique Free/Pro list',
    )
  }
  const editions = editionValues as Edition[]
  if (!editions.includes(expectedEdition)) {
    throw new Error(
      `product-set does not contain requested ${expectedEdition} edition`,
    )
  }
  if (!Array.isArray(manifest.platforms) || manifest.platforms.length === 0) {
    throw new Error('product-set platforms must be a nonempty array')
  }
  const platformTargets: string[] = []
  for (const platformValue of manifest.platforms) {
    assertExactKeys(
      platformValue,
      ['arch', 'os', 'target'],
      'product-set platform',
    )
    const platform = platformValue as PlatformCandidate
    if (typeof platform.target !== 'string') {
      throw new Error('product-set platform target is invalid')
    }
    const contract = nativeTargetByName(platform.target)
    if (contract === undefined)
      throw new Error(`product-set target ${platform.target} is unsupported`)
    const [expectedOS, expectedArch] = platform.target.split('-')
    if (platform.os !== expectedOS || platform.arch !== expectedArch) {
      throw new Error('product-set platform does not match its target')
    }
    platformTargets.push(platform.target)
  }
  if (
    new Set(platformTargets).size !== platformTargets.length ||
    [...platformTargets]
      .sort()
      .some((target, index) => target !== platformTargets[index])
  ) {
    throw new Error('product-set platforms must be sorted and unique')
  }
  if (!Array.isArray(manifest.pairs))
    throw new Error('product-set pairs must be an array')
  const productVersion = manifest.productVersion
  const sourceRevision = manifest.sourceRevision
  const pairs = manifest.pairs.map(reference =>
    validatePair(productRoot, reference, {
      productVersion,
      sourceRevision,
    }),
  )
  const expectedIdentities = editions.flatMap(edition =>
    platformTargets.map(target => `${edition}/${target}`),
  )
  const actualIdentities = pairs.map(pair => `${pair.edition}/${pair.target}`)
  if (
    pairs.length !== expectedIdentities.length ||
    new Set(actualIdentities).size !== actualIdentities.length ||
    expectedIdentities.some(identity => !actualIdentities.includes(identity))
  ) {
    throw new Error(
      'product-set pairs do not close the declared edition/platform matrix',
    )
  }
  const setIdentity: Record<string, unknown> = { ...manifest }
  delete setIdentity['setId']
  if (
    typeof manifest.setId !== 'string' ||
    !DIGEST.test(manifest.setId) ||
    sha256(canonicalJSONString(setIdentity)) !== manifest.setId
  ) {
    throw new Error('product-set setId mismatch')
  }
  const expectedFiles = new Set(['manifest.json'])
  for (const pair of pairs) {
    const prefix = `${pair.edition}/${pair.target}`
    expectedFiles.add(`${prefix}/manifest.json`)
    expectedFiles.add(`${prefix}/${pair.native.path}`)
    expectedFiles.add(`${prefix}/${pair.wasi.path}`)
  }
  const actualFiles = collectTree(productRoot)
  const additional = actualFiles.filter(entry => !expectedFiles.has(entry))
  const missing = [...expectedFiles].filter(
    entry => !actualFiles.includes(entry),
  )
  if (additional.length > 0 || missing.length > 0) {
    throw new Error(
      `product-set tree is not closed: additional=${additional.join(',')} missing=${missing.join(',')}`,
    )
  }
  const selectedPairs = pairs
    .filter(pair => pair.edition === expectedEdition)
    .sort((left, right) => left.target.localeCompare(right.target))
  const [firstPair] = selectedPairs
  if (firstPair === undefined) {
    throw new Error(
      `product-set does not contain requested ${expectedEdition} pairs`,
    )
  }
  for (const pair of selectedPairs.slice(1)) {
    if (
      pair.wasi.size !== firstPair.wasi.size ||
      pair.wasi.sha256 !== firstPair.wasi.sha256 ||
      !pair.wasi.bytes.equals(firstPair.wasi.bytes)
    ) {
      throw new Error('selected product pairs contain different WASI bytes')
    }
  }
  return {
    edition: expectedEdition,
    editions: [...editions],
    pairs: selectedPairs,
    productRoot,
    productVersion,
    setId: manifest.setId,
    sourceRevision,
    wasi: firstPair.wasi,
  }
}

/**
 * loadCLIProductSet verifies the final Free CLI artifact list for npm packaging.
 *
 * The CLI manifest is the only release boundary between Go and Node. Every
 * native executable and the shared WASI module is rehashed before its bytes are
 * exposed through the existing package-construction input type.
 *
 * @param {string} manifestPath Final CLI manifest path.
 * @returns {ProductSet} Verified Free package-construction input.
 */
export const loadCLIProductSet = (manifestPath: string): ProductSet => {
  const suppliedManifest = path.resolve(manifestPath)
  const manifestInformation = lstatSync(suppliedManifest)
  if (manifestInformation.isSymbolicLink() || !manifestInformation.isFile()) {
    throw new Error('CLI manifest must be a regular non-symlink file')
  }
  const productRoot = realpathSync.native(path.dirname(suppliedManifest))
  const manifestBytes = readClosedFile(
    productRoot,
    path.basename(suppliedManifest),
  ).bytes
  const value = parseClosedJSON(manifestBytes, 'CLI manifest')
  assertExactKeys(
    value,
    ['artifacts', 'edition', 'product', 'schema', 'sourceRevision', 'version'],
    'CLI manifest',
  )
  const manifest = value as CLIManifestCandidate
  if (
    manifest.schema !== 'pannonico-free-release/v1' ||
    manifest.product !== 'pannonico' ||
    manifest.edition !== 'free' ||
    typeof manifest.version !== 'string' ||
    !PRODUCT_VERSION.test(manifest.version) ||
    typeof manifest.sourceRevision !== 'string' ||
    !SOURCE_REVISION.test(manifest.sourceRevision)
  ) {
    throw new Error('CLI manifest identity is invalid')
  }
  assertExactKeys(
    manifest.artifacts,
    [...NATIVE_TARGETS.map(({ target }) => target), 'wasip1-wasm'],
    'CLI artifacts',
  )
  const records = manifest.artifacts as Record<string, unknown>
  /** Validate one closed CLI member before it enters the npm producer input set. */
  const readArtifact = (target: string, executable: boolean): ProductMember => {
    const value = records[target]
    assertExactKeys(
      value,
      ['executable', 'filename', 'sha256', 'size'],
      `CLI artifact ${target}`,
    )
    const record = value as CLIArtifactCandidate
    if (
      record.executable !== executable ||
      typeof record.filename !== 'string' ||
      validateRelativePath(
        record.filename,
        `CLI artifact ${target} filename`,
      ) !== record.filename ||
      record.filename.includes('/') ||
      typeof record.sha256 !== 'string' ||
      !DIGEST.test(record.sha256) ||
      typeof record.size !== 'number' ||
      !Number.isSafeInteger(record.size) ||
      record.size <= 0
    ) {
      throw new Error(`CLI artifact ${target} identity is invalid`)
    }
    const file = readClosedFile(productRoot, record.filename, { executable })
    if (
      file.bytes.length !== record.size ||
      sha256(file.bytes) !== record.sha256
    ) {
      throw new Error(`CLI artifact ${target} bytes differ from its manifest`)
    }
    return {
      bytes: file.bytes,
      executable,
      kind: target === 'wasip1-wasm' ? 'wasi' : 'native',
      path: record.filename,
      sha256: record.sha256,
      size: record.size,
      target,
    }
  }
  const wasi = readArtifact('wasip1-wasm', false)
  const pairs = NATIVE_TARGETS.map(({ target }) => {
    const native = readArtifact(target, true)
    return {
      edition: 'free' as const,
      manifestBytes,
      native,
      pairId: sha256(`${target}:${native.sha256}:${wasi.sha256}`),
      target,
      wasi,
    }
  })
  const expectedFiles = [
    'manifest.json',
    ...pairs.map(pair => pair.native.path),
    wasi.path,
  ].sort()
  if (collectTree(productRoot).join('\n') !== expectedFiles.join('\n')) {
    throw new Error('CLI candidate directory contains unexpected content')
  }
  return {
    edition: 'free',
    editions: ['free'],
    pairs,
    productRoot,
    productVersion: manifest.version,
    setId: sha256(manifestBytes),
    sourceRevision: manifest.sourceRevision,
    wasi,
  }
}
