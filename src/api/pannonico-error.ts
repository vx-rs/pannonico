// Imports
// -----------------------------------------------------------------------------
// Types
import type { PannonicoExit, PannonicoResult } from './types.js'

// Classes
// -----------------------------------------------------------------------------
/** Command failure preserving binary exit/diagnostics or the original Node spawn cause. */
export class PannonicoError extends Error {
  /** Completed process state. Finite operations also include stdout and stderr. */
  readonly result: PannonicoExit | PannonicoResult | undefined

  /**
   * Wrap a failed invocation without changing the importing application's exit state.
   * Process adapters retain the exact result; pre-spawn errors retain their cause.
   */
  constructor(
    message: string,
    result?: PannonicoExit | PannonicoResult,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'PannonicoError'
    this.result = result
  }
}
