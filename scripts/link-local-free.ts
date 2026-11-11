// Imports
// -----------------------------------------------------------------------------
// Node.js
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Internal
import { verifyPackageSet } from './package-set.js'

// Constants
// -----------------------------------------------------------------------------

const MONOREPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const PACKAGE_SET_MANIFEST = path.join(
  MONOREPO_ROOT,
  '.local',
  'artifacts',
  'dev',
  'node',
  'free',
  'manifest.json',
)

// npm boundary
// -----------------------------------------------------------------------------

/**
 * runNpmLink registers one already-verified generated launcher as the global development command.
 *
 * The command runs inside the disposable launcher tree with optional packages omitted, lifecycle
 * scripts disabled, and lockfile writes disabled. Native packages are intentionally absent so the
 * linked CLI exercises the bundled WASI path. npm owns the user's configured global prefix and the
 * corresponding reversible link.
 *
 * @param {string} launcherRoot Verified generated launcher directory.
 * @returns {Promise<void>} Resolves after npm creates the global link.
 */
const runNpmLink = async (launcherRoot: string): Promise<void> => {
  const npmCLI = process.env['npm_execpath']
  const executable = npmCLI
    ? process.execPath
    : process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm'
  const arguments_ = [
    ...(npmCLI ? [npmCLI] : []),
    'link',
    '--omit=optional',
    '--ignore-scripts',
    '--package-lock=false',
    '--no-audit',
    '--no-fund',
  ]
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: launcherRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('close', (status, signal) => {
      if (status === 0) resolve()
      else
        reject(
          new Error(
            `npm link failed with status ${status ?? `signal ${signal}`}`,
          ),
        )
    })
  })
}

// Public workflow
// -----------------------------------------------------------------------------

/**
 * linkLocalFree verifies and links only the generated Free launcher package.
 *
 * The Nx target stages Go artifacts and rebuilds the local Free package set before calling this
 * function. Verification rejects stale, incomplete, or altered package output before npm changes
 * the user's global link. This workflow is for local launcher iteration and is never release or
 * candidate validation.
 *
 * @param {string} manifestPath Generated local Free package-set manifest.
 * @param {{link?: typeof runNpmLink}} dependencies Focused-test npm boundary override.
 * @returns {Promise<string>} Linked launcher directory.
 */
export const linkLocalFree = async (
  manifestPath = PACKAGE_SET_MANIFEST,
  dependencies: { link?: typeof runNpmLink } = {},
): Promise<string> => {
  const packageSet = verifyPackageSet(manifestPath, { expectedEdition: 'free' })
  if (
    packageSet.distribution !== 'public' ||
    packageSet.sourceRevision !== 'development'
  ) {
    throw new Error(
      'local Free link requires the development public-shape package set',
    )
  }
  const launcher = packageSet.packages.find(
    record => record.role === 'launcher',
  )
  if (launcher === undefined)
    throw new Error('local Free package set has no launcher')
  const launcherRoot = path.join(
    path.dirname(path.resolve(manifestPath)),
    ...launcher.directory.split('/'),
  )
  await (dependencies.link ?? runNpmLink)(launcherRoot)
  return launcherRoot
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  linkLocalFree().then(
    launcherRoot =>
      console.log(`Linked generated Free launcher from ${launcherRoot}`),
    error => {
      console.error(
        `Pannonico local link failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      process.exitCode = 1
    },
  )
}
