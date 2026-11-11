// Imports
// -----------------------------------------------------------------------------
// Node.js
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdtemp, open, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Internal
import {
  LICENSE_DIGESTS,
  PRIVATE_SOURCE_PACKAGE_FILES,
} from './package-metadata.js'

// Constants
// -----------------------------------------------------------------------------

const PACKAGE_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const MAX_NPM_OUTPUT_BYTES = 4 * 1024 * 1024
const SOURCE_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/

// Types
// -----------------------------------------------------------------------------
interface NpmPackFile {
  path: string
}

interface NpmPackReport {
  entryCount: number
  filename: string
  files: NpmPackFile[]
  name: string
  version: string
}

interface PackExpectation {
  files: string[]
  name: string
  version: string
}

interface NpmPackOptions {
  cacheRoot: string
  destination?: string
  dryRun?: boolean
}

// npm boundary
// -----------------------------------------------------------------------------

/**
 * npmEnvironment removes inherited lifecycle controls that can suppress package-report JSON.
 *
 * The returned environment retains ordinary process configuration but removes the Node test marker
 * and forces an explicit task-local cache. It does not add credentials or registry configuration.
 *
 * @param {string} cacheRoot Disposable npm cache directory.
 * @returns {NodeJS.ProcessEnv} Child environment.
 */
const npmEnvironment = (cacheRoot: string): NodeJS.ProcessEnv => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        name !== 'NODE_TEST_CONTEXT' &&
        !new Set([
          'npm_config_cache',
          'npm_config_loglevel',
          'npm_config_silent',
        ]).has(name.toLowerCase()),
    ),
  ),
  npm_config_cache: cacheRoot,
})

/**
 * runNpmPack invokes npm without a shell and returns its one structured pack report.
 *
 * Package construction uses a real pack destination. Payload verification uses dry-run mode. Both
 * paths capture bounded JSON in a regular file because npm can finish before flushing a pipe.
 *
 * @param {string} packageRoot Package tree to pack.
 * @param {{cacheRoot: string, destination?: string, dryRun?: boolean}} options Isolated npm options.
 * @returns {Promise<Record<string, unknown>>} Single npm pack report.
 */
export const runNpmPack = async (
  packageRoot: string,
  options: NpmPackOptions,
): Promise<NpmPackReport> => {
  const npmCLI = process.env['npm_execpath']
  const executable = npmCLI
    ? process.execPath
    : process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm'
  const prefix = npmCLI ? [npmCLI] : []
  const args = [
    ...prefix,
    'pack',
    '--json',
    '--ignore-scripts',
    '--loglevel=notice',
    ...(options.dryRun === true ? ['--dry-run'] : []),
    ...(options.destination === undefined
      ? []
      : ['--pack-destination', path.resolve(options.destination)]),
  ]
  const outputPath = path.join(
    options.cacheRoot,
    `pack-report-${Date.now()}-${process.pid}.json`,
  )
  const output = await open(outputPath, 'w')
  let diagnostic = ''
  try {
    diagnostic = await new Promise<string>((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: packageRoot,
        env: npmEnvironment(options.cacheRoot),
        stdio: ['ignore', output.fd, 'pipe'],
        windowsHide: true,
      })
      const chunks: Buffer[] = []
      let size = 0
      if (child.stderr === null)
        throw new Error('npm pack stderr was unavailable')
      child.stderr.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size <= MAX_NPM_OUTPUT_BYTES) chunks.push(chunk)
      })
      child.once('error', reject)
      child.once('close', (status, signal) => {
        const stderr = Buffer.concat(chunks).toString('utf8')
        if (size > MAX_NPM_OUTPUT_BYTES) {
          reject(
            new Error('npm pack diagnostic exceeded the verification limit'),
          )
        } else if (status !== 0) {
          reject(
            new Error(
              `npm pack failed with status ${status ?? `signal ${signal}`}: ${stderr.trim() || 'no diagnostic'}`,
            ),
          )
        } else {
          resolve(stderr)
        }
      })
    })
  } finally {
    await output.close()
  }
  const bytes = await readFile(outputPath)
  if (bytes.length > MAX_NPM_OUTPUT_BYTES)
    throw new Error('npm pack JSON exceeded the limit')
  if (bytes.length === 0) {
    throw new Error(
      `npm pack returned no JSON: ${diagnostic.trim() || 'no diagnostic'}`,
    )
  }
  let decoded
  try {
    decoded = JSON.parse(bytes.toString('utf8')) as unknown
  } catch (error) {
    throw new Error('npm pack returned malformed JSON', { cause: error })
  }
  // npm 12 keys pack reports by package name; earlier npm releases returned an array.
  const keyedReports =
    decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded)
      ? Object.entries(decoded as Record<string, unknown>)
      : []
  const reports = Array.isArray(decoded)
    ? decoded
    : keyedReports.length === 1 &&
        keyedReports[0]?.[1] !== null &&
        typeof keyedReports[0]?.[1] === 'object' &&
        (keyedReports[0][1] as Record<string, unknown>)['name'] ===
          keyedReports[0][0]
      ? [keyedReports[0][1]]
      : []
  if (reports.length !== 1 || !isNpmPackReport(reports[0])) {
    throw new Error('npm pack returned an unexpected report')
  }
  return reports[0]
}

/** Validates the npm JSON fields consumed by package construction. */
const isNpmPackReport = (value: unknown): value is NpmPackReport => {
  if (value === null || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  return (
    typeof report['entryCount'] === 'number' &&
    typeof report['filename'] === 'string' &&
    typeof report['name'] === 'string' &&
    typeof report['version'] === 'string' &&
    Array.isArray(report['files']) &&
    report['files'].every(
      entry =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as Record<string, unknown>)['path'] === 'string',
    )
  )
}

/**
 * verifyPackReport compares npm's complete payload and identity to an explicit allowlist.
 *
 * The check covers every file, not only executable paths. npm-calculated size and integrity remain
 * informational because the package-set manifest independently hashes the final tarball bytes.
 *
 * @param {Record<string, unknown>} report npm pack JSON record.
 * @param {{files: string[], name: string, version: string}} expected Expected package contract.
 * @returns {string[]} Sorted verified file paths.
 */
export const verifyPackReport = (
  report: NpmPackReport,
  expected: PackExpectation,
): string[] => {
  if (
    report.name !== expected.name ||
    report.version !== expected.version ||
    typeof report.filename !== 'string' ||
    path.basename(report.filename) !== report.filename ||
    report.entryCount !== expected.files.length
  ) {
    throw new Error(`npm pack metadata is invalid for ${expected.name}`)
  }
  const actualFiles = report.files.map(entry => entry.path).sort()
  const wantedFiles = [...expected.files].sort()
  if (
    actualFiles.length !== wantedFiles.length ||
    actualFiles.some((file, index) => file !== wantedFiles[index])
  ) {
    throw new Error(
      `npm pack file list is invalid for ${expected.name}: expected=${wantedFiles.join(',')} actual=${actualFiles.join(',')}`,
    )
  }
  return actualFiles
}

/**
 * verifyPackagePayload runs a dry pack and enforces one package's full file allowlist.
 *
 * @param {string} packageRoot Generated package tree.
 * @param {{files: string[], name: string, version: string}} expected Expected package contract.
 * @returns {Promise<string[]>} Verified sorted payload paths.
 */
export const verifyPackagePayload = async (
  packageRoot: string,
  expected: PackExpectation,
): Promise<string[]> => {
  const cacheRoot = await mkdtemp(
    path.join(os.tmpdir(), 'pannonico-npm-pack-cache-'),
  )
  try {
    const report = await runNpmPack(packageRoot, { cacheRoot, dryRun: true })
    return verifyPackReport(report, expected)
  } finally {
    await rm(cacheRoot, { force: true, recursive: true })
  }
}

// Source package check
// -----------------------------------------------------------------------------

/**
 * verifySourcePackage checks the non-publishable maintainer package's runtime payload.
 *
 * Release metadata exists only in disposable generated trees. This check ensures source packaging
 * cannot accidentally include tests, workspaces, maintainer tools, or staged Go artifacts.
 *
 * @param {string} packageRoot Checked-in Node source package.
 * @returns {Promise<string[]>} Verified source payload inventory.
 */
export const verifySourcePackage = async (
  packageRoot = PACKAGE_ROOT,
): Promise<string[]> => {
  const metadata = JSON.parse(
    await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
  )
  if (
    metadata.name !== '@vx.rs/pannonico' ||
    typeof metadata.version !== 'string' ||
    !SOURCE_VERSION.test(metadata.version) ||
    metadata.private !== true ||
    metadata.license !==
      '(PolyForm-Noncommercial-1.0.0 OR PolyForm-Small-Business-1.0.0)' ||
    metadata.publishConfig !== undefined ||
    metadata.pannonico !== undefined
  ) {
    throw new Error(
      'checked-in launcher package must remain private source metadata',
    )
  }
  for (const [relative, expectedDigest] of Object.entries(LICENSE_DIGESTS)) {
    const bytes = await readFile(path.join(packageRoot, ...relative.split('/')))
    if (createHash('sha256').update(bytes).digest('hex') !== expectedDigest) {
      throw new Error(
        `checked-in legal file ${relative} does not match the approved content`,
      )
    }
  }
  return verifyPackagePayload(packageRoot, {
    files: [...PRIVATE_SOURCE_PACKAGE_FILES],
    name: metadata.name,
    version: metadata.version,
  })
}

/**
 * runCLI prints the maintainer runtime payload count for package-native and CI logs.
 *
 * @returns {Promise<void>} Resolves after source metadata and allowlist verification.
 */
const runCLI = async () => {
  const files = await verifySourcePackage()
  console.log(`Verified maintainer runtime payload (${files.length} files).`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCLI().catch(error => {
    console.error(
      `Pannonico package verification failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
