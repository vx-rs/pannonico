// Imports
// -----------------------------------------------------------------------------
// Internal
import { BUILD_FLAGS, optionArguments, rootArguments } from './arguments.js'
import { runCommand } from './run-command.js'

// Types
import type {
  BuildOptions,
  ExecutionOptions,
  PannonicoResult,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Build or dry-run through the installed binary, returning captured process output.
 * The binary owns project validation, reports, capabilities, and publication.
 */
export const build = async (
  options: BuildOptions = {},
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> => {
  const args = [
    'build',
    ...optionArguments(options, BUILD_FLAGS),
    ...rootArguments(options, execution),
  ]
  return runCommand(args, execution)
}
