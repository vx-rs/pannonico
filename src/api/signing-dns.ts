// Imports
// -----------------------------------------------------------------------------
// Internal
import { rootArguments } from './arguments.js'
import { runCommand } from './run-command.js'

// Types
import type {
  SigningDnsOptions,
  ExecutionOptions,
  PannonicoResult,
} from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * Returns the experimental signing TXT record in `stdout`. The Pro binary
 * reads the selected project's signing keys and site URL to produce the
 * record. Copy that record to your DNS provider when you are ready to publish it.
 */
export const signingDns = async (
  options: SigningDnsOptions = {},
  execution: ExecutionOptions = {},
): Promise<PannonicoResult> => {
  const args = [
    'signing-dns',
    // This command's parser requires a separate config token rather than equals form.
    ...(options.config === undefined
      ? []
      : ['--config', String(options.config)]),
    ...(options.help ? ['--help'] : []),
    ...rootArguments(options, execution),
  ]
  return runCommand(args, execution)
}
