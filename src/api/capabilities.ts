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
 * Prints the features compiled into the installed binary. Use the result
 * to check its edition and runtime limits without loading a project.
 * `stdout` contains the CLI text. With `help` set, it contains usage instead.
 */
export const capabilities = async (
  options: CapabilitiesOptions = {},
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> =>
  runCommand(['capabilities', ...(options.help ? ['--help'] : [])], execution)
