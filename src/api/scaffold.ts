// Imports
// -----------------------------------------------------------------------------
// Internal
import { optionArguments, rootArguments } from './arguments.js'
import { runCommand } from './run-command.js'

// Types
import type {
  ScaffoldOptions,
  ExecutionOptions,
  PannonicoResult,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Create an edition-matched starter using the installed binary.
 * Mode conflicts and overwrites retain existing CLI validation.
 */
export const scaffold = async (
  options: ScaffoldOptions = {},
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> => {
  const args = [
    'scaffold',
    ...optionArguments(options, [
      ['empty', 'empty'],
      ['min', 'min'],
      ['vite', 'vite'],
      ['withDocs', 'with-docs'],
      ['force', 'force'],
      ['help', 'help'],
    ]),
    ...rootArguments(options, execution),
  ]
  return runCommand(args, execution)
}
