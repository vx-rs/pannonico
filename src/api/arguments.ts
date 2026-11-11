// Imports
// -----------------------------------------------------------------------------
// Node.js
import path from 'node:path'

// Types
import type { BuildOptions, ExecutionOptions, RootOptions } from './types.js'

// Constants
// -----------------------------------------------------------------------------
/** CLI tokens are the binary protocol, not a second source of defaults or validation policy. */
export const BUILD_FLAGS: readonly (readonly [keyof BuildOptions, string])[] = [
  ['config', 'config'],
  ['pages', 'pages'],
  ['layouts', 'layouts'],
  ['partials', 'partials'],
  ['data', 'data'],
  ['dataUrls', 'data-url'],
  ['out', 'out'],
  ['defaultLayout', 'default-layout'],
  ['defaultLanguage', 'default-language'],
  ['htmlValidation', 'html-validation'],
  ['maxOutputWorkers', 'max-output-workers'],
  ['jobs', 'jobs'],
  ['dryRun', 'dry-run'],
  ['reportJson', 'report-json'],
  ['quiet', 'quiet'],
  ['verbose', 'verbose'],
  ['noColor', 'no-color'],
  ['beautify', 'beautify'],
  ['minify', 'minify'],
  ['help', 'help'],
]

// Functions
// -----------------------------------------------------------------------------
/**
 * Translate typed properties to existing CLI values without applying product policy.
 * Equals-form scalars keep help-looking values in their option role under WASI mapping.
 */
export const optionArguments = (
  options: object,
  flags: readonly (readonly [string, string])[],
): string[] =>
  flags.flatMap(([key, flag]) => {
    const value = (options as Record<string, unknown>)[key]
    if (value === undefined) return []
    const values = Array.isArray(value) ? value : [value]
    return values.map(entry => `--${flag}=${String(entry)}`)
  })

/**
 * Preserve omitted/empty roots while making a selected path an unambiguous positional.
 * Absolute resolution prevents dash-prefixed file names becoming options in the
 * MCP, signing, and watch parsers, which do not uniformly support a separator.
 */
export const rootArguments = (
  options: RootOptions,
  execution: ExecutionOptions,
): string[] =>
  options.root === undefined
    ? []
    : [
        options.root === ''
          ? ''
          : path.resolve(execution.cwd ?? process.cwd(), options.root),
      ]
