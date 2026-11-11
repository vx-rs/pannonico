// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Constants
// -----------------------------------------------------------------------------
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

// Functions
// -----------------------------------------------------------------------------
/**
 * Select the maintainer artifact workspace without coupling npm source to Go's checkout.
 * Standalone work uses this owner's .local; private release orchestration passes
 * its existing .local explicitly. This affects tooling only, never runtime identity.
 */
export const npmLocalRoot = (
  environment: NodeJS.ProcessEnv = process.env,
): string =>
  path.resolve(
    environment['PANNONICO_NPM_LOCAL_ROOT'] ??
      path.join(REPOSITORY_ROOT, '.local'),
  )
