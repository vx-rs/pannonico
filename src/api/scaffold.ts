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
 * Runs the installed binary to create a starter for its edition. Select a
 * destination with `root` and choose a starter mode when you need one.
 * The promise rejects with the binary's diagnostics if the selected mode
 * or the files already at the destination prevent the scaffold.
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
