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
 * Print the experimental signing TXT record from the binary's configured keys.
 * This invokes the existing Pro helper and does not modify DNS.
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
