// Imports
// -----------------------------------------------------------------------------
// Internal
import { optionArguments, rootArguments } from './arguments.js'
import { runCommand } from './run-command.js'

// Types
import type {
  ManualOptions,
  ExecutionOptions,
  PannonicoResult,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Returns help for the embedded manual by default. With `eject` set,
 * the installed binary writes the manual that ships with it under
 * `documentation/` in the selected directory. The binary enforces its
 * existing rules for conflicts with files at the destination.
 */
export const manual = async (
  options: ManualOptions = {},
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> => {
  const args = [
    'manual',
    ...optionArguments(options, [
      ['eject', 'eject'],
      ['help', 'help'],
    ]),
    ...rootArguments(options, execution),
  ]
  return runCommand(args, execution)
}
