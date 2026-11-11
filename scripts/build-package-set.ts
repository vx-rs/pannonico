// Imports
// -----------------------------------------------------------------------------
// Node.js
import { realpathSync } from 'node:fs'
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Internal
import { nativeTargetByName, WASI_TARGET } from '../src/lib/targets.js'
import { npmLocalRoot } from './local-root.js'
import { isNodeArtifactOutput } from './node-artifact-output.js'
import {
  artifactPayloadFiles,
  createArtifactManifest,
  createLauncherManifest,
  LAUNCHER_FILES,
  LICENSE_DIGESTS,
  packageDirectory,
  SOURCE_PACKAGE_FILES,
  tarballFilename,
} from './package-metadata.js'
import { verifyPackageSet } from './package-set.js'
import {
  canonicalJSONString,
  loadProductSet,
  sha256,
} from './product-contract.js'
import { runNpmPack, verifyPackReport } from './verify-package.js'

// Types
import type {
  GeneratedPackageDescriptor,
  PackageDistribution,
  PackageMode,
  PackageSetRecord,
  ProductMember,
  ProductSet,
  SourcePackageMetadata,
} from './types.js'
import type { NativeTarget } from '../src/lib/types.js'

// Constants
// -----------------------------------------------------------------------------

const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const PUBLIC_README = path.join(PACKAGE_ROOT, 'documentation', 'npm-readme.md')
// Resolve platform aliases such as macOS /var before lexical containment checks
// so temporary output and later realpath guards use one filesystem identity.
const TEMP_ROOT = realpathSync.native(os.tmpdir())
const PROTECTED_ROOTS = [
  path.parse(PACKAGE_ROOT).root,
  os.homedir(),
  TEMP_ROOT,
  PACKAGE_ROOT,
]
const LEGAL_FILES = Object.keys(LICENSE_DIGESTS)

// Types
// -----------------------------------------------------------------------------
interface BuildPackageSetOptions {
  localRoot?: string
  edition: 'free' | 'pro'
  mode: PackageMode
  outputRoot: string
  productManifest: string
}

interface BuildPackageSetDependencies {
  loadProduct?: typeof loadProductSet
}

interface PackedPackage {
  filename: string
  sha256: string
  size: number
}

/** hasErrorCode narrows filesystem failures used by package output safety checks. */
const hasErrorCode = (error: unknown, code: string): boolean =>
  error !== null &&
  typeof error === 'object' &&
  'code' in error &&
  (error as { code?: unknown }).code === code

// Output safety
// -----------------------------------------------------------------------------

/**
 * pathsOverlap reports whether either resolved path contains the other.
 *
 * @param {string} first First absolute path.
 * @param {string} second Second absolute path.
 * @returns {boolean} Whether recursive replacement could affect both paths.
 */
const pathsOverlap = (first: string, second: string): boolean => {
  const one = path.relative(first, second)
  const two = path.relative(second, first)
  /** Treat only a true descendant or the same path as overlapping replacement inputs. */
  const contained = (value: string): boolean =>
    value === '' ||
    (!path.isAbsolute(value) &&
      value !== '..' &&
      !value.startsWith(`..${path.sep}`))
  return contained(one) || contained(two)
}

/**
 * isDescendant reports whether one resolved path is strictly below an allowed output base.
 *
 * @param {string} base Allowed base directory.
 * @param {string} candidate Requested descendant.
 * @returns {boolean} Whether candidate is strictly contained.
 */
const isDescendant = (base: string, candidate: string): boolean => {
  const relative = path.relative(path.resolve(base), path.resolve(candidate))
  return (
    relative !== '' &&
    !path.isAbsolute(relative) &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`)
  )
}

/**
 * inspectExistingDirectoryChain rejects symlinks before recursive directory creation can follow one.
 *
 * @param {string} base Existing allowed output base.
 * @param {string} destination Requested descendant directory.
 * @returns {Promise<void>} Resolves when every existing authored component is a real directory.
 */
const inspectExistingDirectoryChain = async (
  base: string,
  destination: string,
): Promise<void> => {
  let current = path.resolve(base)
  const baseInformation = await lstat(current)
  if (baseInformation.isSymbolicLink() || !baseInformation.isDirectory()) {
    throw new Error(
      `npm package output base is not a real directory: ${current}`,
    )
  }
  for (const component of path
    .relative(current, destination)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, component)
    try {
      const information = await lstat(current)
      if (information.isSymbolicLink() || !information.isDirectory()) {
        throw new Error(
          `npm package output path is not a real directory: ${current}`,
        )
      }
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) return
      throw error
    }
  }
}

/**
 * assertSafeOutput protects source, input, home, temporary, and filesystem roots from replacement.
 *
 * Caller-provided descendants such as `.local/artifacts/dev/node/free` remain valid. Existing
 * output and parent paths must be real directories so atomic replacement cannot follow a symlink.
 *
 * @param {string} outputRoot Requested package-set output.
 * @param {string} productRoot Verified Go product-set root.
 * @returns {Promise<string>} Resolved safe output path.
 */
const assertSafeOutput = async (
  outputRoot: string,
  productRoot: string,
  localRoot: string,
): Promise<string> => {
  const output = path.resolve(outputRoot)
  if (
    PROTECTED_ROOTS.some(
      protectedRoot => output === path.resolve(protectedRoot),
    )
  ) {
    throw new Error(`refusing broad npm package output ${output}`)
  }
  const allowedBase = isNodeArtifactOutput(output, localRoot)
    ? path.dirname(localRoot)
    : isDescendant(TEMP_ROOT, output)
      ? TEMP_ROOT
      : undefined
  if (allowedBase === undefined) {
    throw new Error(
      'npm package output must be an .local/artifacts/<stage>/node/<set> leaf or a temporary test path',
    )
  }
  if (
    (pathsOverlap(output, PACKAGE_ROOT) &&
      !isDescendant(path.join(PACKAGE_ROOT, '.local'), output)) ||
    pathsOverlap(output, productRoot)
  ) {
    throw new Error(
      'npm package output overlaps protected source or product artifacts',
    )
  }
  await inspectExistingDirectoryChain(allowedBase, path.dirname(output))
  await mkdir(path.dirname(output), { recursive: true })
  for (const candidate of [path.dirname(output), output]) {
    try {
      const information = await lstat(candidate)
      if (information.isSymbolicLink() || !information.isDirectory()) {
        throw new Error(
          `npm package output path is not a real directory: ${candidate}`,
        )
      }
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT') && candidate === output) {
        continue
      }
      throw error
    }
  }
  return output
}

/**
 * installStagedOutput atomically replaces one complete package-set directory.
 *
 * The prior output is renamed aside only after all staging checks pass. A failed final rename
 * restores it, and successful replacement removes the backup.
 *
 * @param {string} staging Fully verified staging directory.
 * @param {string} output Final output directory.
 */
const installStagedOutput = async (
  staging: string,
  output: string,
): Promise<void> => {
  const backup = `${output}.previous-${process.pid}`
  let hadOutput = false
  try {
    await lstat(output)
    hadOutput = true
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  try {
    await lstat(backup)
    throw new Error(`npm package output backup already exists: ${backup}`)
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  if (hadOutput) await rename(output, backup)
  try {
    await rename(staging, output)
  } catch (error) {
    if (hadOutput) await rename(backup, output)
    throw error
  }
  if (hadOutput) await rm(backup, { force: true, recursive: true })
}

// Package tree construction
// -----------------------------------------------------------------------------

/**
 * writeJSON writes stable human-readable generated metadata with a final newline.
 *
 * @param {string} destination Generated file path.
 * @param {Record<string, unknown>} value JSON value.
 */
const writeJSON = async (
  destination: string,
  value: unknown,
): Promise<void> => {
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o644,
  })
}

/**
 * copyLauncherSource copies only checked-in files named by the source-package allowlist.
 *
 * @param {string} packageRoot Disposable launcher package root.
 */
const copyLauncherSource = async (packageRoot: string): Promise<void> => {
  for (const relative of SOURCE_PACKAGE_FILES) {
    if (relative === 'package.json' || relative === 'README.md') continue
    const source = path.join(PACKAGE_ROOT, ...relative.split('/'))
    const destination = path.join(packageRoot, ...relative.split('/'))
    const information = await lstat(source)
    if (information.isSymbolicLink() || !information.isFile()) {
      throw new Error(`launcher source is not a regular file: ${relative}`)
    }
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(source, destination)
    if (relative === 'dist/js/bin/pannonico.js') await chmod(destination, 0o755)
  }
}

/**
 * writeLauncherReadme creates distribution-facing documentation for the generated CLI package.
 *
 * Free output copies the checked-in npm README verbatim so the registry page remains reviewable in
 * source. The maintainer-package README is never copied into a public tarball. Development Pro
 * output receives a separate local-only notice without exposing a publication path.
 *
 * @param {string} packageRoot Disposable launcher package root.
 * @param {{edition: "free" | "pro", productVersion: string}} product Verified product selection.
 */
const writeLauncherReadme = async (
  packageRoot: string,
  product: ProductSet,
): Promise<void> => {
  if (product.edition === 'free') {
    await writeFile(
      path.join(packageRoot, 'README.md'),
      await readFile(PUBLIC_README),
      {
        mode: 0o644,
      },
    )
    return
  }
  await writeFile(
    path.join(packageRoot, 'README.md'),
    `# Pannonico\n\nThis development-only package contains local Pro verification artifacts for Pannonico ${product.productVersion} and is not publishable.\n`,
    { encoding: 'utf8', mode: 0o644 },
  )
}

/**
 * writeBundledWasi copies the one verified portable Go member into the launcher package.
 *
 * `loadProductSet` has already proved every selected platform pair supplies byte-identical WASI
 * output. Keeping the copy at this boundary makes the launcher tarball the sole portable runtime
 * owner and avoids another npm package or an install-time download.
 *
 * @param {string} packageRoot Disposable launcher package root.
 * @param {{bytes: Buffer}} member Verified shared WASI member.
 */
const writeBundledWasi = async (
  packageRoot: string,
  member: ProductMember,
): Promise<void> => {
  const destination = path.join(packageRoot, ...WASI_TARGET.payload.split('/'))
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, member.bytes, { mode: 0o644 })
}

/**
 * writeArtifactTree creates one dependency-free executable package from a verified Go member.
 *
 * @param {string} packagesRoot Generated packages directory.
 * @param {Record<string, unknown>} source Checked-in source metadata.
 * @param {Record<string, unknown>} product Verified product selection.
 * @param {Record<string, string>} contract Native package contract.
 * @param {Record<string, unknown>} member Verified Go member with exact bytes.
 * @param {"public" | "development"} distribution Output distribution.
 * @returns {Promise<{files: string[], manifest: Record<string, unknown>, root: string}>} Generated tree.
 */
const writeArtifactTree = async (
  packagesRoot: string,
  source: SourcePackageMetadata,
  product: ProductSet,
  contract: NativeTarget,
  member: ProductMember,
  distribution: PackageDistribution,
): Promise<GeneratedPackageDescriptor> => {
  const root = path.join(packagesRoot, packageDirectory(contract.packageName))
  await mkdir(path.join(root, path.dirname(contract.payload)), {
    recursive: true,
  })
  for (const legal of LEGAL_FILES) {
    const destination = path.join(root, ...legal.split('/'))
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(path.join(PACKAGE_ROOT, ...legal.split('/')), destination)
  }
  await writeFile(
    path.join(root, 'README.md'),
    `# ${contract.packageName}\n\nGenerated ${product.edition} Pannonico ${contract.target} artifact.\n`,
    { encoding: 'utf8', mode: 0o644 },
  )
  const payloadPath = path.join(root, ...contract.payload.split('/'))
  await writeFile(payloadPath, member.bytes, {
    mode:
      contract.platform !== undefined && contract.platform !== 'win32'
        ? 0o755
        : 0o644,
  })
  const manifest = createArtifactManifest(
    source,
    product,
    contract,
    member,
    distribution,
  )
  await writeJSON(path.join(root, 'package.json'), manifest)
  return {
    files: artifactPayloadFiles(contract),
    manifest,
    role: 'native',
    root,
    target: contract.target,
  }
}

/**
 * packTree verifies a dry-run allowlist, creates a real tarball, and returns its record data.
 *
 * @param {Record<string, unknown>} descriptor Generated package descriptor.
 * @param {string} tarballsRoot Package-set tarball directory.
 * @param {string} cacheRoot Fresh task-local npm cache.
 * @returns {Promise<{filename: string, sha256: string, size: number}>} Stable tarball identity.
 */
const packTree = async (
  descriptor: GeneratedPackageDescriptor,
  tarballsRoot: string,
  cacheRoot: string,
): Promise<PackedPackage> => {
  const expected = {
    files: descriptor.files,
    name: descriptor.manifest.name,
    version: descriptor.manifest.version,
  }
  verifyPackReport(
    await runNpmPack(descriptor.root, { cacheRoot, dryRun: true }),
    expected,
  )
  const report = await runNpmPack(descriptor.root, {
    cacheRoot,
    destination: tarballsRoot,
  })
  verifyPackReport(report, expected)
  const packedPath = path.join(tarballsRoot, report.filename)
  const stableName = tarballFilename(
    descriptor.manifest.name,
    descriptor.manifest.version,
  )
  const stablePath = path.join(tarballsRoot, stableName)
  if (packedPath !== stablePath) await rename(packedPath, stablePath)
  const bytes = await readFile(stablePath)
  return {
    filename: `tarballs/${stableName}`,
    sha256: sha256(bytes),
    size: bytes.length,
  }
}

/**
 * packageRecord binds one generated tree, npm payload inventory, dependencies, and tarball bytes.
 *
 * @param {Record<string, unknown>} descriptor Generated package descriptor.
 * @param {Record<string, unknown>} packed Stable tarball identity.
 * @param {{edition: "free" | "pro"}} product Verified product selection.
 * @param {"public" | "development"} distribution Output distribution.
 * @returns {Record<string, unknown>} Closed package record.
 */
const packageRecord = (
  descriptor: GeneratedPackageDescriptor,
  packed: PackedPackage,
  product: ProductSet,
  distribution: PackageDistribution,
): PackageSetRecord => ({
  dependencies: {},
  directory: `packages/${packageDirectory(descriptor.manifest.name)}`,
  edition: product.edition,
  filename: packed.filename,
  files: [...descriptor.files].sort(),
  name: descriptor.manifest.name,
  optionalDependencies:
    'optionalDependencies' in descriptor.manifest
      ? descriptor.manifest.optionalDependencies
      : {},
  private: distribution === 'development',
  role: descriptor.role,
  sha256: packed.sha256,
  size: packed.size,
  target: descriptor.target,
})

// Public builder
// -----------------------------------------------------------------------------

/**
 * buildPackageSet consumes one explicit Go manifest and writes a final npm package set.
 *
 * `public` mode accepts only a Free-only Go set. `local-free` selects Free from the combined
 * development set but generates the same publishable package shape. `development-pro` selects Pro
 * and marks every package private. All source copying, npm packing, verification, and output
 * replacement occur below caller-provided disposable roots.
 *
 * @param {{edition: "free" | "pro", mode: "development-pro" | "local-free" | "public", outputRoot: string, productManifest: string}} options Explicit build inputs.
 * @returns {Promise<string>} Final manifest path.
 */
export const buildPackageSet = async (
  options: BuildPackageSetOptions,
  dependencies: BuildPackageSetDependencies = {},
): Promise<string> => {
  if (!new Set(['public', 'local-free', 'development-pro']).has(options.mode)) {
    throw new Error(
      'package mode must be public, local-free, or development-pro',
    )
  }
  if (
    (options.mode === 'development-pro' && options.edition !== 'pro') ||
    (options.mode !== 'development-pro' && options.edition !== 'free')
  ) {
    throw new Error('package mode and edition do not match')
  }
  const product = (dependencies.loadProduct ?? loadProductSet)(
    options.productManifest,
    options.edition,
  )
  if (
    options.mode === 'public' &&
    product.editions.some(edition => edition !== 'free')
  ) {
    throw new Error(
      'public package mode rejects mixed-edition or Pro product sets',
    )
  }
  const distribution =
    options.mode === 'development-pro' ? 'development' : 'public'
  const output = await assertSafeOutput(
    options.outputRoot,
    product.productRoot,
    path.resolve(options.localRoot ?? npmLocalRoot()),
  )
  const source = JSON.parse(
    await readFile(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
  ) as SourcePackageMetadata
  const staging = await mkdtemp(
    path.join(path.dirname(output), `.${path.basename(output)}-stage-`),
  )
  const cacheRoot = await mkdtemp(
    path.join(os.tmpdir(), 'pannonico-package-cache-'),
  )
  try {
    const packagesRoot = path.join(staging, 'packages')
    const tarballsRoot = path.join(staging, 'tarballs')
    await mkdir(packagesRoot, { recursive: true })
    await mkdir(tarballsRoot, { recursive: true })
    const launcherRoot = path.join(packagesRoot, packageDirectory('pannonico'))
    await mkdir(launcherRoot, { recursive: true })
    await copyLauncherSource(launcherRoot)
    await writeBundledWasi(launcherRoot, product.wasi)
    await writeLauncherReadme(launcherRoot, product)
    const launcherManifest = createLauncherManifest(
      source,
      product,
      distribution,
    )
    await writeJSON(path.join(launcherRoot, 'package.json'), launcherManifest)
    const descriptors: GeneratedPackageDescriptor[] = [
      {
        files: [...LAUNCHER_FILES].sort(),
        manifest: launcherManifest,
        role: 'launcher',
        root: launcherRoot,
        target: 'launcher',
      },
    ]
    for (const pair of product.pairs) {
      const contract = nativeTargetByName(pair.target)
      if (contract === undefined)
        throw new Error(`unsupported native package target ${pair.target}`)
      descriptors.push(
        await writeArtifactTree(
          packagesRoot,
          source,
          product,
          contract,
          pair.native,
          distribution,
        ),
      )
    }
    const records: PackageSetRecord[] = []
    for (const descriptor of descriptors) {
      records.push(
        packageRecord(
          descriptor,
          await packTree(descriptor, tarballsRoot, cacheRoot),
          product,
          distribution,
        ),
      )
    }
    records.sort((left, right) =>
      left.role === 'launcher'
        ? -1
        : right.role === 'launcher'
          ? 1
          : left.name.localeCompare(right.name),
    )
    const manifest = {
      distribution,
      edition: product.edition,
      packages: records,
      productVersion: product.productVersion,
      sourceRevision: product.sourceRevision,
    }
    const stagedManifest = path.join(staging, `.manifest-${process.pid}.json`)
    await writeFile(stagedManifest, canonicalJSONString(manifest), {
      encoding: 'utf8',
      mode: 0o644,
    })
    await rename(stagedManifest, path.join(staging, 'manifest.json'))
    verifyPackageSet(path.join(staging, 'manifest.json'), {
      expectedEdition: options.edition,
    })
    await installStagedOutput(staging, output)
    return path.join(output, 'manifest.json')
  } finally {
    await rm(cacheRoot, { force: true, recursive: true })
    await rm(staging, { force: true, recursive: true })
  }
}

// CLI
// -----------------------------------------------------------------------------

/**
 * parseArguments reads the four explicit package construction inputs.
 *
 * @param {string[]} argv Arguments excluding Node and script paths.
 * @returns {Record<string, string>} Parsed builder options.
 */
export const parseArguments = (argv: string[]): BuildPackageSetOptions => {
  const names = new Map<string, keyof BuildPackageSetOptions>([
    ['--edition', 'edition'],
    ['--mode', 'mode'],
    ['--output-root', 'outputRoot'],
    ['--product-manifest', 'productManifest'],
  ])
  const result: Partial<BuildPackageSetOptions> = {}
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    const name = flag === undefined ? undefined : names.get(flag)
    if (
      name === undefined ||
      typeof value !== 'string' ||
      value === '' ||
      value.startsWith('--')
    ) {
      throw new Error(
        'Usage: build-package-set --product-manifest PATH --output-root DIR --edition free|pro --mode public|local-free|development-pro',
      )
    }
    if (Object.hasOwn(result, name))
      throw new Error(`${flag} may be supplied only once`)
    Object.assign(result, { [name]: value })
  }
  if ([...names.values()].some(name => !Object.hasOwn(result, name))) {
    throw new Error(
      'Usage: build-package-set --product-manifest PATH --output-root DIR --edition free|pro --mode public|local-free|development-pro',
    )
  }
  return result as BuildPackageSetOptions
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  buildPackageSet(parseArguments(process.argv.slice(2))).then(
    manifest => console.log(`Created npm package set ${manifest}`),
    error => {
      console.error(
        `Pannonico package construction failed: ${error instanceof Error ? error.message : error}`,
      )
      process.exitCode = 1
    },
  )
}
