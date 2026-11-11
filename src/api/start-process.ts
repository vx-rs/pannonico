// Imports
// -----------------------------------------------------------------------------
// Node.js
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Internal
import { PannonicoError } from './pannonico-error.js'

// Types
import type { ChildProcess } from 'node:child_process'
import type { ExecutionOptions, PannonicoResult } from './types.js'

// Constants
// -----------------------------------------------------------------------------
// Always launch the adjacent installed CLI. PATH/global tools cannot select a
// different binary identity; the CLI retains native/WASI integrity selection.
const CLI_PATH = fileURLToPath(new URL('../bin/pannonico.js', import.meta.url))

// Functions
// -----------------------------------------------------------------------------
/**
 * Start the package's CLI in a separate process and settle after its streams close.
 * Isolation keeps launcher signal handlers and synchronous WASI out of the caller.
 * Only finite commands capture output; session pipes belong to their consumer.
 */
export const startProcess = (
  args: readonly string[],
  execution: ExecutionOptions,
  mode: 'capture' | 'watch' | 'mcp',
): { child: ChildProcess; completed: Promise<PannonicoResult> } => {
  const env = { ...process.env, ...execution.env }
  for (const [key, value] of Object.entries(env))
    if (value === undefined) delete env[key]
  let child: ChildProcess
  try {
    child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd: path.resolve(execution.cwd ?? process.cwd()),
      env,
      stdio:
        mode === 'watch'
          ? ['ignore', 'inherit', 'inherit']
          : mode === 'mcp'
            ? ['pipe', 'pipe', 'pipe']
            : ['ignore', 'pipe', 'pipe'],
    })
  } catch (cause) {
    throw new PannonicoError('Could not start Pannonico', undefined, { cause })
  }
  let stdout = ''
  let stderr = ''
  if (mode === 'capture') {
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk
    })
  }
  const completed = new Promise<PannonicoResult>((resolve, reject) => {
    let spawnFailure: Error | undefined
    child.once('error', cause => {
      spawnFailure = cause
    })
    // close follows exit and drained stdio. Resolving on exit can truncate the
    // report text or final diagnostic when the binary writes just before exit.
    child.once('close', (exitCode, signal) => {
      const result = { exitCode, signal, stdout, stderr }
      if (spawnFailure !== undefined) {
        reject(
          new PannonicoError('Could not start Pannonico', result, {
            cause: spawnFailure,
          }),
        )
      } else if (exitCode !== 0 || signal !== null) {
        reject(
          new PannonicoError(
            `Pannonico ${signal ? `terminated by ${signal}` : `exited with code ${exitCode}`}`,
            result,
          ),
        )
      } else resolve(result)
    })
  })
  return { child, completed }
}
