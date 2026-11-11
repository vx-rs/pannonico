// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Internal
import { npmLocalRoot } from './local-root.js'
import { NATIVE_TARGETS } from '../src/lib/targets.js'
import { buildPackageSet } from './build-package-set.js'
import { loadCLIProductSet } from './product-contract.js'
import {
  nodeReleaseCandidateRoot,
  requireAbsoluteReleasePath,
  resolveReleaseIdentity,
} from './release-context.js'

// Types
import type { ProductSet } from './types.js'

// Constants
// -----------------------------------------------------------------------------

const CLI_MANIFEST_ENVIRONMENT = 'PANNONICO_RELEASE_CLI_MANIFEST'

// Types
// -----------------------------------------------------------------------------
interface BuildReleaseOptions {
  edition: 'free'
  environment?: NodeJS.ProcessEnv
}

interface ReleaseProductExpectation {
  edition: 'free'
  sourceRevision: string
  version: string
}

interface BuildReleaseDependencies {
  build?: typeof buildPackageSet
  loadProduct?: (manifestPath: string) => ProductSet
}

// Release construction
// -----------------------------------------------------------------------------

/**
 * assertReleaseProduct verifies identity and the complete native matrix before npm packing.
 *
 * The Go contract loader has already checked every closed-tree byte. This adapter adds the release-
 * specific requirement that one separate edition set matches the root version and source revision.
 *
 * @param {Record<string, unknown>} product Verified Go product selection.
 * @param {{edition: "free", sourceRevision: string, version: string}} expected Release identity.
 */
const assertReleaseProduct = (
  product: ProductSet,
  expected: ReleaseProductExpectation,
): void => {
  const targets = product.pairs.map(({ target }) => target)
  const expectedTargets = NATIVE_TARGETS.map(({ target }) => target)
  if (
    product.edition !== expected.edition ||
    product.editions.length !== 1 ||
    product.editions[0] !== expected.edition
  ) {
    throw new Error(
      `release ${expected.edition} packaging requires a separate ${expected.edition} product set`,
    )
  }
  if (
    product.productVersion !== expected.version ||
    product.sourceRevision !== expected.sourceRevision
  ) {
    throw new Error(
      'release product version or source revision does not match root identity',
    )
  }
  if (
    targets.length !== expectedTargets.length ||
    targets.some((target, index) => target !== expectedTargets[index])
  ) {
    throw new Error(
      'release product set does not contain the complete native platform matrix',
    )
  }
}

/**
 * buildReleasePackageSet converts one final CLI release into npm candidate tarballs.
 *
 * The caller supplies the final Go CLI manifest while this package owns the
 * versioned npm output and all metadata, tarball, and closure rules.
 *
 * @param {{edition: "free", environment?: NodeJS.ProcessEnv}} options Release inputs.
 * @param {{build?: typeof buildPackageSet, loadProduct?: typeof loadProductSet}} dependencies Focused-test overrides.
 * @returns {Promise<string>} Final npm package manifest path.
 */
export const buildReleasePackageSet = async (
  options: BuildReleaseOptions,
  dependencies: BuildReleaseDependencies = {},
): Promise<string> => {
  if (options.edition !== 'free') {
    throw new Error('release package construction supports only Free')
  }
  const environment = options.environment ?? process.env
  const identity = resolveReleaseIdentity(environment)
  const productManifest = requireAbsoluteReleasePath(
    environment,
    CLI_MANIFEST_ENVIRONMENT,
  )
  const loadProduct = dependencies.loadProduct ?? loadCLIProductSet
  const product = loadProduct(productManifest)
  assertReleaseProduct(product, { ...identity, edition: options.edition })
  if (identity.track !== 'cli') {
    throw new Error(
      'PANNONICO_RELEASE_TRACK must be cli for npm release packaging',
    )
  }
  const outputRoot = nodeReleaseCandidateRoot(
    identity.version,
    options.edition,
    identity.track,
    npmLocalRoot(environment),
  )
  const build = dependencies.build ?? buildPackageSet
  const manifestPath = await build(
    {
      edition: options.edition,
      mode: 'public',
      outputRoot,
      productManifest,
      localRoot: npmLocalRoot(environment),
    },
    { loadProduct: () => product },
  )
  return manifestPath
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
    throw new Error('Usage: build-release-package-set --edition free')
  return { edition }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  buildReleasePackageSet(parseArguments(process.argv.slice(2))).then(
    manifest => console.log(`Built release npm candidate at ${manifest}`),
    error => {
      console.error(
        `Pannonico release package build failed: ${error instanceof Error ? error.message : error}`,
      )
      process.exitCode = 1
    },
  )
}
