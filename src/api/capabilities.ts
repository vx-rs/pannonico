// Imports
// -----------------------------------------------------------------------------
// Internal
import { runCommand } from './run-command.js'

// Types
import type {
  ExecutionOptions,
  PannonicoResult,
  CapabilitiesOptions,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Inspect the exact binary's compiled capabilities without loading a project.
 * Output remains the existing textual CLI contract, including target limitations.
 */
export const capabilities = async (
  options: CapabilitiesOptions = {},
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> =>
  runCommand(['capabilities', ...(options.help ? ['--help'] : [])], execution)
