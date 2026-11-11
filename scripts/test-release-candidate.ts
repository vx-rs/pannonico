// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Internal
import { npmLocalRoot } from './local-root.js'
import { NATIVE_TARGETS } from '../src/lib/targets.js'
import { installPackageSet } from './install-package-set.js'
import { verifyPackageSet } from './package-set.js'
import {
  nodeCandidateInstallRoot,
  requireAbsoluteReleasePath,
  resolveReleaseIdentity,
} from './release-context.js'
import { testInstalledPackage } from './test-installed-package.js'

// Constants
// -----------------------------------------------------------------------------

const CANDIDATE_MANIFEST_ENVIRONMENT = 'PANNONICO_CANDIDATE_FREE_NPM_MANIFEST'

// Types
// -----------------------------------------------------------------------------
interface CandidateOptions {
  edition: 'free'
  environment?: NodeJS.ProcessEnv
}

interface CandidateExpectation {
  edition: 'free'
  sourceRevision: string
  version: string
}

interface CandidatePackageSet {
  distribution: 'development' | 'public'
  packages: Array<{ role: 'launcher' | 'native'; target: string }>
  productVersion: string
  sourceRevision: string
}

interface CandidateDependencies {
  install?: (
    options: Parameters<typeof installPackageSet>[0],
  ) => Promise<unknown>
  smoke?: (
    options: Parameters<typeof testInstalledPackage>[0],
  ) => Promise<unknown>
  verify?: (
    manifest: string,
    options: { expectedEdition: 'free' },
  ) => CandidatePackageSet | Promise<CandidatePackageSet>
}

// Candidate acceptance
// -----------------------------------------------------------------------------

/**
 * assertCandidatePackageSet requires the final release identity and distribution policy.
 *
 * The package-set verifier has already checked all trees, tarballs, inventories, dependencies, and
 * digests. This adapter rejects incomplete or non-public sets.
 *
 * @param {Record<string, unknown>} packageSet Verified npm package set.
 * @param {{edition: "free", sourceRevision: string, version: string}} expected Candidate identity.
 */
const assertCandidatePackageSet = (
  packageSet: CandidatePackageSet,
  expected: CandidateExpectation,
): void => {
  const nativeTargets = packageSet.packages
    .filter(({ role }) => role === 'native')
    .map(({ target }) => target)
    .sort()
  const expectedTargets = NATIVE_TARGETS.map(({ target }) => target).sort()
  if (
    packageSet.productVersion !== expected.version ||
    packageSet.sourceRevision !== expected.sourceRevision
  ) {
    throw new Error(
      'candidate npm version or source revision does not match root identity',
    )
  }
  if (packageSet.distribution !== 'public') {
    throw new Error('candidate Free npm distribution must be public')
  }
  if (
    nativeTargets.length !== expectedTargets.length ||
    nativeTargets.some((target, index) => target !== expectedTargets[index])
  ) {
    throw new Error(
      'candidate npm package set does not contain the complete native platform matrix',
    )
  }
}

/**
 * testReleaseCandidate installs and exercises one exact final npm package set offline.
 *
 * This consume-only route has no producer import or Nx dependency. It installs into a versioned
 * disposable root, then runs the installed current-host native package and an isolated copy with
 * that native package removed to force the launcher's bundled WASI fallback.
 *
 * @param {{edition: "free", environment?: NodeJS.ProcessEnv}} options Candidate inputs.
 * @param {{install?: typeof installPackageSet, smoke?: typeof testInstalledPackage, verify?: (manifest: string, options: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>}} dependencies Focused-test overrides.
 * @returns {Promise<string>} Versioned install root after successful smoke tests.
 */
export const testReleaseCandidate = async (
  options: CandidateOptions,
  dependencies: CandidateDependencies = {},
): Promise<string> => {
  if (options.edition !== 'free')
    throw new Error('candidate package edition must be free')
  const environment = options.environment ?? process.env
  const identity = resolveReleaseIdentity(environment)
  const packageManifest = requireAbsoluteReleasePath(
    environment,
    CANDIDATE_MANIFEST_ENVIRONMENT,
  )
  let packageSet: CandidatePackageSet
  if (dependencies.verify !== undefined) {
    packageSet = await dependencies.verify(packageManifest, {
      expectedEdition: options.edition,
    })
  } else {
    packageSet = verifyPackageSet(packageManifest, {
      expectedEdition: options.edition,
    })
  }
  assertCandidatePackageSet(packageSet, {
    ...identity,
    edition: options.edition,
  })
  const installRoot = nodeCandidateInstallRoot(
    identity.version,
    options.edition,
    identity.track,
    npmLocalRoot(environment),
  )
  const install = dependencies.install ?? installPackageSet
  const smoke = dependencies.smoke ?? testInstalledPackage
  await install({
    installRoot,
    packageManifest,
    localRoot: npmLocalRoot(environment),
  })
  await smoke({
    edition: options.edition,
    installRoot,
    packageManifest,
  })
  return installRoot
}

/**
 * parseArguments accepts the single fixed edition selector used by package.json and Nx.
 *
 * @param {string[]} argv Arguments excluding Node and script paths.
 * @returns {{edition: "free"}} Validated command input.
 */
export const parseArguments = (argv: string[]): { edition: 'free' } => {
  const edition = argv[1]
  if (argv.length !== 2 || argv[0] !== '--edition' || edition !== 'free')
    throw new Error('Usage: test-release-candidate --edition free')
  return { edition }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  testReleaseCandidate(parseArguments(process.argv.slice(2))).then(
    installRoot =>
      console.log(
        `Candidate native and missing-native WASI paths passed at ${installRoot}`,
      ),
    error => {
      console.error(
        `Pannonico candidate npm test failed: ${error instanceof Error ? error.message : error}`,
      )
      process.exitCode = 1
    },
  )
}
