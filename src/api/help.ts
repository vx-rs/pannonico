// Imports
// -----------------------------------------------------------------------------
// Internal
import { runCommand } from './run-command.js'

// Types
import type { ExecutionOptions, PannonicoResult, HelpTopic } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Returns the installed binary's command help in `stdout`. Omit `topic`
 * for the top-level usage. A topic that the binary cannot handle fails with
 * the same exit status as running the help command in a terminal.
 */
export const help = async (
  topic?: HelpTopic,
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> =>
  runCommand(['help', ...(topic === undefined ? [] : [topic])], execution)
