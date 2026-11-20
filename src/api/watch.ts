// Imports
// -----------------------------------------------------------------------------
// Internal
import { BUILD_FLAGS, optionArguments, rootArguments } from './arguments.js'
import { startProcess } from './start-process.js'

// Types
import type {
  WatchOptions,
  ExecutionOptions,
  PannonicoProcess,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Starts the installed native binary's preview server and rebuild loop.
 * The returned process exposes `completed`, which you should observe for
 * startup errors and shutdown. Wait for the server's readiness output before
 * sending requests. Keep the process handle if you need to stop watching.
 */
export const watch = (
  options: WatchOptions = {},
  execution: ExecutionOptions = {},
): PannonicoProcess => {
  const args = [
    'watch',
    ...optionArguments(options, BUILD_FLAGS),
    ...optionArguments(options, [
      ['host', 'host'],
      ['port', 'port'],
      ['open', 'open'],
    ]),
    ...rootArguments(options, execution),
  ]
  return startProcess(args, execution, 'watch')
}
