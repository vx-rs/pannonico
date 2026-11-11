// Imports
// -----------------------------------------------------------------------------
// Node.js
import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Internal
import { nativeTargetByName } from '../src/lib/targets.js'
import { npmLocalRoot } from './local-root.js'
import { verifyPackageSet } from './package-set.js'

// Types
import type { PackageSetManifest } from './types.js'

// Constants
// -----------------------------------------------------------------------------

const MAX_NPM_OUTPUT_BYTES = 4 * 1024 * 1024
const REGISTRY_URL = /https?:\/\//i
// Resolve platform aliases such as macOS /var before lexical containment checks
// so temporary output and later realpath guards use one filesystem identity.
const TEMP_ROOT = realpathSync.native(os.tmpdir())

// Types
// -----------------------------------------------------------------------------
interface InstallPackageSetOptions {
  localRoot?: string
  installRoot: string
  packageManifest: string
}

interface PackageLockEntry {
  dependencies?: Record<string, unknown>
  optionalDependencies?: Record<string, unknown>
  version?: unknown
}

interface PackageLock {
  packages?: Record<string, PackageLockEntry>
}

/** hasErrorCode narrows filesystem failures used by installed-package path checks. */
const hasErrorCode = (error: unknown, code: string): boolean =>
  error !== null &&
  typeof error === 'object' &&
  'code' in error &&
  (error as { code?: unknown }).code === code

// Filesystem safety
// -----------------------------------------------------------------------------

/**
 * pathsOverlap reports whether either resolved path contains the other.
 *
 * @param {string} first First absolute path.
 * @param {string} second Second absolute path.
 * @returns {boolean} Whether recursive replacement could affect both paths.
 */
const pathsOverlap = (first: string, second: string): boolean => {
  /** Treat only a true descendant or the same path as overlapping replacement inputs. */
  const contained = (value: string): boolean =>
    value === '' ||
    (!path.isAbsolute(value) &&
      value !== '..' &&
      !value.startsWith(`..${path.sep}`))
  return (
    contained(path.relative(first, second)) ||
    contained(path.relative(second, first))
  )
}

/**
 * isDescendant reports whether an install root is strictly below an allowed disposable base.
 *
 * @param {string} base Allowed base directory.
 * @param {string} candidate Requested install root.
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
 * inspectExistingDirectoryChain rejects symlinks before recursive install-root creation.
 *
 * @param {string} base Existing allowed base.
 * @param {string} destination Requested descendant directory.
 * @returns {Promise<void>} Resolves when existing components are real directories.
 */
const inspectExistingDirectoryChain = async (
  base: string,
  destination: string,
): Promise<void> => {
  let current = path.resolve(base)
  const baseInformation = await lstat(current)
  if (baseInformation.isSymbolicLink() || !baseInformation.isDirectory()) {
    throw new Error(`npm install base is not a real directory: ${current}`)
  }
  for (const component of path
    .relative(current, destination)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, component)
    try {
      const information = await lstat(current)
      if (information.isSymbolicLink() || !information.isDirectory()) {
        throw new Error(`npm install path is not a real directory: ${current}`)
      }
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT')) return
      throw error
    }
  }
}

/**
 * assertSafeInstallRoot rejects broad or package-overlapping offline install destinations.
 *
 * Lexical and canonical package roots are both protected because the manifest may be reached
 * through a directory symlink. Existing destination components cannot be symlinks, and their
 * canonical location is checked again after parent creation to keep replacement outside the
 * package set. Repository output is limited to `.local/install/node`; temporary descendants remain
 * available to focused tests.
 *
 * @param {string} installRoot Requested install output.
 * @param {string[]} packageRoots Lexical and canonical package-set roots.
 * @returns {Promise<string>} Resolved safe install path.
 */
const assertSafeInstallRoot = async (
  installRoot: string,
  packageRoots: string[],
  localRoot: string,
): Promise<string> => {
  const output = path.resolve(installRoot)
  const installBase = path.join(localRoot, 'install', 'node')
  const repositoryOutput = isDescendant(installBase, output)
  const allowedBase = repositoryOutput
    ? path.dirname(localRoot)
    : isDescendant(TEMP_ROOT, output)
      ? TEMP_ROOT
      : undefined
  if (
    allowedBase === undefined ||
    new Set([
      path.parse(output).root,
      os.homedir(),
      TEMP_ROOT,
      localRoot,
      installBase,
    ]).has(output) ||
    packageRoots.some(packageRoot =>
      pathsOverlap(output, path.resolve(packageRoot)),
    )
  ) {
    throw new Error(`refusing broad or overlapping npm install root ${output}`)
  }
  await inspectExistingDirectoryChain(allowedBase, path.dirname(output))
  await mkdir(path.dirname(output), { recursive: true })
  for (const candidate of [path.dirname(output), output]) {
    try {
      const information = await lstat(candidate)
      if (information.isSymbolicLink() || !information.isDirectory()) {
        throw new Error(
          `npm install path is not a real directory: ${candidate}`,
        )
      }
    } catch (error) {
      if (hasErrorCode(error, 'ENOENT') && candidate === output) {
        continue
      }
      throw error
    }
  }
  const canonicalAllowedBase = await realpath(
    repositoryOutput ? installBase : TEMP_ROOT,
  )
  const canonicalParent = await realpath(path.dirname(output))
  let canonicalOutput = path.join(canonicalParent, path.basename(output))
  try {
    canonicalOutput = await realpath(output)
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
  if (
    !isDescendant(canonicalAllowedBase, canonicalOutput) ||
    packageRoots.some(packageRoot =>
      pathsOverlap(canonicalOutput, path.resolve(packageRoot)),
    )
  ) {
    throw new Error(`refusing canonical npm install root ${canonicalOutput}`)
  }
  return output
}

/**
 * installStagedOutput atomically replaces one verified offline install tree.
 *
 * @param {string} staging Fully installed staging directory.
 * @param {string} output Final install root.
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
    throw new Error(`npm install backup already exists: ${backup}`)
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

// npm installation
// -----------------------------------------------------------------------------

/**
 * runOfflineInstall invokes npm with a fresh cache and no lifecycle scripts or network fallback.
 *
 * @param {string} workspace Disposable install workspace.
 * @param {string} cacheRoot Fresh cache below that workspace.
 * @returns {Promise<void>} Resolves after npm exits successfully.
 */
const runOfflineInstall = async (
  workspace: string,
  cacheRoot: string,
): Promise<void> => {
  const npmCLI = process.env['npm_execpath']
  const executable = npmCLI
    ? process.execPath
    : process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm'
  const args = [
    ...(npmCLI ? [npmCLI] : []),
    'install',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=true',
  ]
  const environment = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) =>
          name !== 'NODE_TEST_CONTEXT' &&
          !new Set(['npm_config_cache', 'npm_config_offline']).has(
            name.toLowerCase(),
          ),
      ),
    ),
    npm_config_cache: cacheRoot,
    npm_config_offline: 'true',
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: workspace,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const chunks: Buffer[] = []
    let size = 0
    for (const stream of [child.stdout, child.stderr]) {
      if (stream === null)
        throw new Error('offline npm install stream was unavailable')
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size <= MAX_NPM_OUTPUT_BYTES) chunks.push(chunk)
      })
    }
    child.once('error', reject)
    child.once('close', (status, signal) => {
      const diagnostic = Buffer.concat(chunks).toString('utf8').trim()
      if (size > MAX_NPM_OUTPUT_BYTES) {
        reject(new Error('offline npm install output exceeded the limit'))
      } else if (status !== 0) {
        reject(
          new Error(
            `offline npm install failed with status ${status ?? `signal ${signal}`}: ${diagnostic || 'no diagnostic'}`,
          ),
        )
      } else {
        resolve()
      }
    })
  })
}

/**
 * validateInstalledTopology checks the lock and host-visible installed packages after npm exits.
 *
 * File tarball dependencies must remain local in the lock. The launcher is always installed; the
 * matching native package is required when the package set supplies the current host target.
 *
 * @param {string} root Completed install workspace.
 * @param {Record<string, unknown>} packageSet Verified package-set manifest.
 */
const validateInstalledTopology = async (
  root: string,
  packageSet: PackageSetManifest,
): Promise<void> => {
  const lockText = await readFile(path.join(root, 'package-lock.json'), 'utf8')
  if (REGISTRY_URL.test(lockText)) {
    throw new Error('offline install lock contains an npm registry URL')
  }
  const lock = JSON.parse(lockText) as PackageLock
  const rootLock = lock.packages?.['']
  if (rootLock === undefined)
    throw new Error('offline install lock omits root metadata')
  for (const record of packageSet.packages) {
    const contract =
      record.role === 'native' ? nativeTargetByName(record.target) : undefined
    const shouldInstall =
      record.role !== 'native' ||
      (contract?.platform === process.platform &&
        contract.architecture === process.arch)
    const installedManifest = path.join(
      root,
      'node_modules',
      ...record.name.split('/'),
      'package.json',
    )
    let metadata: unknown
    try {
      metadata = JSON.parse(
        await readFile(installedManifest, 'utf8'),
      ) as unknown
    } catch (error) {
      if (!shouldInstall && hasErrorCode(error, 'ENOENT')) {
        continue
      }
      throw new Error(`${record.name} expected installed metadata is missing`, {
        cause: error,
      })
    }
    if (!shouldInstall) {
      throw new Error(
        `${record.name} was installed despite incompatible OS/CPU metadata`,
      )
    }
    if (
      metadata === null ||
      typeof metadata !== 'object' ||
      (metadata as Record<string, unknown>)['name'] !== record.name ||
      (metadata as Record<string, unknown>)['version'] !==
        packageSet.productVersion
    ) {
      throw new Error(
        `${record.name} installed metadata does not match the package set`,
      )
    }
    const lockKey = `node_modules/${record.name}`
    if (lock.packages?.[lockKey]?.version !== packageSet.productVersion) {
      throw new Error(
        `${record.name} lock entry does not match the package set`,
      )
    }
  }
  if (
    !Object.values(rootLock.dependencies ?? {}).every(
      value => typeof value === 'string' && value.startsWith('file:'),
    ) ||
    !Object.values(rootLock.optionalDependencies ?? {}).every(
      value => typeof value === 'string' && value.startsWith('file:'),
    )
  ) {
    throw new Error(
      'offline install root dependencies must all use file: tarballs',
    )
  }
}

// Public installer
// -----------------------------------------------------------------------------

/**
 * installPackageSet installs exact verified tarballs into a disposable workspace without a registry.
 *
 * The generated root manifest names only the launcher tarball as a required `file:` dependency and
 * native tarballs as optional `file:` dependencies so npm can skip foreign OS/CPU packages. The
 * launcher's bundled WASI bytes require no separate resolution. A fresh cache, offline mode,
 * ignored scripts, lock audit, and topology check make network or source-link substitution visible.
 *
 * @param {{installRoot: string, packageManifest: string}} options Explicit install inputs.
 * @returns {Promise<string>} Final installed workspace path.
 */
export const installPackageSet = async (
  options: InstallPackageSetOptions,
): Promise<string> => {
  const suppliedManifest = path.resolve(options.packageManifest)
  const packageSet = verifyPackageSet(suppliedManifest)
  const lexicalPackageRoot = path.dirname(suppliedManifest)
  const canonicalManifest = await realpath(suppliedManifest)
  const packageRoot = path.dirname(canonicalManifest)
  const output = await assertSafeInstallRoot(
    options.installRoot,
    [lexicalPackageRoot, packageRoot],
    path.resolve(options.localRoot ?? npmLocalRoot()),
  )
  const staging = await mkdtemp(
    path.join(path.dirname(output), `.${path.basename(output)}-stage-`),
  )
  try {
    const dependencies: Record<string, string> = {}
    const optionalDependencies: Record<string, string> = {}
    for (const record of packageSet.packages) {
      const reference = `file:${path.join(packageRoot, ...record.filename.split('/'))}`
      if (record.role === 'native')
        optionalDependencies[record.name] = reference
      else dependencies[record.name] = reference
    }
    await writeFile(
      path.join(staging, 'package.json'),
      `${JSON.stringify(
        {
          name: `pannonico-${packageSet.edition}-offline-install`,
          version: '0.0.0',
          private: true,
          dependencies,
          optionalDependencies,
        },
        null,
        2,
      )}\n`,
      { encoding: 'utf8', mode: 0o644 },
    )
    const cacheRoot = path.join(staging, '.npm-cache')
    await mkdir(cacheRoot)
    await runOfflineInstall(staging, cacheRoot)
    await rm(cacheRoot, { force: true, recursive: true })
    await validateInstalledTopology(staging, packageSet)
    await installStagedOutput(staging, output)
    return output
  } finally {
    await rm(staging, { force: true, recursive: true })
  }
}

// CLI
// -----------------------------------------------------------------------------

/**
 * parseArguments reads the explicit package-set manifest and install-root options.
 *
 * @param {string[]} argv Arguments excluding Node and script paths.
 * @returns {{installRoot: string, packageManifest: string}} Parsed options.
 */
export const parseArguments = (argv: string[]): InstallPackageSetOptions => {
  const result: Partial<InstallPackageSetOptions> = {}
  const names = new Map<string, keyof InstallPackageSetOptions>([
    ['--install-root', 'installRoot'],
    ['--package-manifest', 'packageManifest'],
  ])
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
        'Usage: install-package-set --package-manifest PATH --install-root DIR',
      )
    }
    if (Object.hasOwn(result, name))
      throw new Error(`${flag} may be supplied only once`)
    Object.assign(result, { [name]: value })
  }
  if (!result.installRoot || !result.packageManifest) {
    throw new Error(
      'Usage: install-package-set --package-manifest PATH --install-root DIR',
    )
  }
  return result as InstallPackageSetOptions
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  installPackageSet(parseArguments(process.argv.slice(2))).then(
    root => console.log(`Installed npm package set at ${root}`),
    error => {
      console.error(
        `Pannonico offline install failed: ${error instanceof Error ? error.message : error}`,
      )
      process.exitCode = 1
    },
  )
}
