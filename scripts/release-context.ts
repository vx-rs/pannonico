// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'

// Internal
import { npmLocalRoot } from './local-root.js'
import { validateNpmVersion } from './package-metadata.js'

// Constants
// -----------------------------------------------------------------------------

const SOURCE_REVISION = /^(?:development|[0-9a-f]{40})$/

// Types
// -----------------------------------------------------------------------------
/** ReleaseIdentity is the validated root-owned identity shared by Node release consumers. */
export interface ReleaseIdentity {
  sourceRevision: string
  track: 'cli'
  version: string
}

// Functions
// -----------------------------------------------------------------------------
/**
 * resolveReleaseIdentity validates the root-owned identity inherited by Node release commands.
 *
 * Both package production and candidate acceptance use this boundary so their versioned output
 * paths and manifest checks cannot disagree. It performs no filesystem writes or artifact work.
 *
 * @param environment Command environment supplied by root orchestration.
 * @returns Validated release identity.
 */
export const resolveReleaseIdentity = (
  environment: NodeJS.ProcessEnv = process.env,
): ReleaseIdentity => {
  const version = validateNpmVersion(environment['PANNONICO_RELEASE_VERSION'])
  const sourceRevision = environment['PANNONICO_SOURCE_REVISION']
  if (
    typeof sourceRevision !== 'string' ||
    !SOURCE_REVISION.test(sourceRevision)
  ) {
    throw new Error(
      'PANNONICO_SOURCE_REVISION must be development or a full lowercase 40-hex revision',
    )
  }
  const track = environment['PANNONICO_RELEASE_TRACK']
  if (track !== 'cli') throw new Error('PANNONICO_RELEASE_TRACK must be cli')
  return { sourceRevision, track, version }
}

/**
 * requireAbsoluteReleasePath reads one explicit manifest path without inferring producer layout.
 *
 * Root release commands supply final candidate paths. An
 * absolute requirement keeps package-native commands independent of their caller's working directory.
 *
 * @param {NodeJS.ProcessEnv} environment Command environment.
 * @param {string} name Required environment variable name.
 * @returns {string} Normalized absolute manifest path.
 */
export const requireAbsoluteReleasePath = (
  environment: NodeJS.ProcessEnv,
  name: string,
): string => {
  const value = environment[name]
  if (typeof value !== 'string' || value === '' || !path.isAbsolute(value)) {
    throw new Error(`${name} must be an absolute path`)
  }
  return path.resolve(value)
}

/**
 * nodeReleaseCandidateRoot returns the final npm candidate leaf for an edition.
 *
 * The package builder revalidates this exact versioned shape before atomic replacement.
 *
 * @param {string} version Validated npm release version.
 * @param {"free"} edition Package-set edition.
 * @param {"cli"} track Scoped release owner.
 * @returns {string} Absolute npm candidate output root.
 */
export const nodeReleaseCandidateRoot = (
  version: string,
  edition: 'free',
  track: 'cli',
  localRoot = npmLocalRoot(),
): string =>
  path.join(
    localRoot,
    'artifacts',
    'release',
    track,
    version,
    'candidate',
    'npm',
    edition,
  )

/**
 * nodeCandidateInstallRoot returns a versioned disposable install workspace for candidate smoke.
 *
 * Installs live outside the immutable candidate tree and below the installer's existing safe root.
 *
 * @param {string} version Validated npm release version.
 * @param {"free"} edition Package-set edition.
 * @param {"cli"} track Scoped release owner.
 * @returns {string} Absolute offline install root.
 */
export const nodeCandidateInstallRoot = (
  version: string,
  edition: 'free',
  track: 'cli',
  localRoot = npmLocalRoot(),
): string =>
  path.join(localRoot, 'install', 'node', 'release', track, version, edition)
