// Imports
// -----------------------------------------------------------------------------
// Internal
import { runCommand } from './run-command.js'

// Types
import type { ExecutionOptions, PannonicoResult } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Returns the installed binary's version, edition, and execution target as
 * the CLI prints them. Read `stdout` when reporting which build ran.
 */
export const version = async (
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> => runCommand(['--version'], execution)
