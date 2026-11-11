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
 * Start native Pro watch with inherited output and a caller-owned process lifetime.
 * Observe completed immediately; process creation does not indicate serving readiness.
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
