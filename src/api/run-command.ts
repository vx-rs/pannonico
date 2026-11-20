// Imports
// -----------------------------------------------------------------------------
// Internal
import { startProcess } from './start-process.js'

// Types
import type { ExecutionOptions, PannonicoResult } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Runs a finite API command with stdin disconnected and collects stdout
 * and stderr. Callers can await one promise for the result, including
 * rejection when Node cannot start the child.
 */
export const runCommand = async (
  args: readonly string[],
  execution: ExecutionOptions,
): Promise<PannonicoResult> =>
  startProcess(args, execution, 'capture').completed
