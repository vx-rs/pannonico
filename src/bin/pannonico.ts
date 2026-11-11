#!/usr/bin/env node

// Imports
// -----------------------------------------------------------------------------
// Internal
import { main } from '../lib/launcher.js'

// Entrypoint
// -----------------------------------------------------------------------------
main(process.argv.slice(2)).then(
  status => {
    process.exitCode = status
  },
  error => {
    console.error(
      `Pannonico launcher failed: ${error instanceof Error ? error.message : error}`,
    )
    process.exitCode = 1
  },
)
