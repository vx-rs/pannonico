// Imports
// -----------------------------------------------------------------------------
// Internal
import { runCommand } from './run-command.js'

// Types
import type { ExecutionOptions, PannonicoResult, HelpTopic } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Read root or command help from the installed binary.
 * Edition-specific help and unavailable topics retain their binary exit behavior.
 */
export const help = async (
  topic?: HelpTopic,
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> =>
  runCommand(['help', ...(topic === undefined ? [] : [topic])], execution)
