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
 * Builds the selected project with the binary installed by this npm package.
 * With no options, it uses the invocation directory. Set `dryRun` to see the
 * planned output and diagnostics without publishing the site. The promise
 * returns captured output and rejects when the command fails.
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
