// Imports
// -----------------------------------------------------------------------------
// Internal
import { rootArguments } from './arguments.js'
import { startProcess } from './start-process.js'

// Types
import type {
  RootOptions,
  ExecutionOptions,
  PannonicoProcess,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Start the installed MCP stdio server with pipes for the caller's protocol client.
 * Drain stdout/stderr and observe completed; ending stdin requests normal MCP closure.
 */
export const mcp = (
  options: RootOptions = {},
  execution: ExecutionOptions = {},
): PannonicoProcess => {
  const args = [
    'mcp',
    ...(options.help ? ['--help'] : []),
    ...rootArguments(options, execution),
  ]
  return startProcess(args, execution, 'mcp')
}
