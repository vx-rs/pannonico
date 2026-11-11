// Imports
// -----------------------------------------------------------------------------
// Internal
import { runCommand } from './run-command.js'

// Types
import type { ExecutionOptions, PannonicoResult } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Read the installed binary's version, edition, and execution target.
 * Returns its exact output rather than parsing presentation text into a new schema.
 */
export const version = async (
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> => runCommand(['--version'], execution)
