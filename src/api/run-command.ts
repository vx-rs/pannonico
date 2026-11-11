// Imports
// -----------------------------------------------------------------------------
// Internal
import { startProcess } from './start-process.js'

// Types
import type { ExecutionOptions, PannonicoResult } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Run a finite command with captured output and ignored stdin.
 * The async boundary also turns synchronous Node argument/spawn errors into
 * promise rejection for build scripts awaiting any finite operation.
 */
export const runCommand = async (
  args: readonly string[],
  execution: ExecutionOptions,
): Promise<PannonicoResult> =>
  startProcess(args, execution, 'capture').completed
