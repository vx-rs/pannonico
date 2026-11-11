// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'

// Internal
import { npmLocalRoot } from './local-root.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * isNodeArtifactOutput limits repository-local package output to approved development and release leaves.
 *
 * Existing `.local/artifacts/<stage>/node/<set>` development output remains compatible. Release
 * output is the track-scoped final
 * `.local/artifacts/release/cli/<version>/candidate/npm/<edition>` leaf.
 *
 * @param {string} candidate Requested output path.
 * @returns {boolean} Whether the resolved path has the repository-owned Node artifact shape.
 */
export const isNodeArtifactOutput = (
  candidate: string,
  localRoot = npmLocalRoot(),
): boolean => {
  const parts = path
    .relative(localRoot, path.resolve(candidate))
    .split(path.sep)
  return (
    (parts.length === 4 &&
      parts[0] === 'artifacts' &&
      parts[1] !== '' &&
      parts[1] !== 'release' &&
      parts[2] === 'node' &&
      parts[3] !== '') ||
    (parts.length === 7 &&
      parts[0] === 'artifacts' &&
      parts[1] === 'release' &&
      parts[2] === 'cli' &&
      parts[3] !== '' &&
      parts[4] === 'candidate' &&
      parts[5] === 'npm' &&
      (parts[6] === 'free' || parts[6] === 'pro'))
  )
}
