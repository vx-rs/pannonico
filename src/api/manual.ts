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
 * Display manual help or eject the binary's version-matched documentation.
 * Ejection writes below the selected destination using the CLI's overwrite policy.
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
