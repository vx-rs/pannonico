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
 * Starts the installed MCP server for the selected project. Send protocol
 * requests on `child.stdin`, read replies from `child.stdout`, and drain
 * `child.stderr` for diagnostics. End stdin for normal shutdown and observe
 * `completed` for startup errors or the final exit result.
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
