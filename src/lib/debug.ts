// Imports
// -----------------------------------------------------------------------------
// Types
import type { TextWriter } from './types.js'

// Functions
// -----------------------------------------------------------------------------
/**
 * createDebugLogger returns the launcher's opt-in diagnostic boundary.
 *
 * Selection code writes only fixed host and execution-mode messages through this function. It
 * keeps normal output silent, writes enabled diagnostics to stderr, and never receives arguments,
 * environment values, project paths, or other user-controlled content.
 */
export const createDebugLogger = (
  environment: NodeJS.ProcessEnv = process.env,
  stderr: TextWriter = process.stderr,
): ((message: string) => void) => {
  const enabled = environment['PANNONICO_LAUNCHER_DEBUG'] === '1'
  return (message: string) => {
    if (enabled) stderr.write(`[pannonico launcher] ${message}\n`)
  }
}
