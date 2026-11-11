// Imports
// -----------------------------------------------------------------------------
// External
import { defineConfig } from 'vitest/config'

// Config
// -----------------------------------------------------------------------------
export default defineConfig({
  test: {
    environment: 'node',
    reporters: ['dot'],
    silent: true,
    // The supported node:wasi import emits this routine Node warning in workers.
    // Keep unit output quiet while retaining failures and other warning classes.
    execArgv: ['--disable-warning=ExperimentalWarning'],
    include: ['src/**/__tests__/*.test.ts', 'scripts/**/__tests__/*.test.ts'],
    // Real offline npm installs take longer than pure unit tests. This is the
    // existing package-construction test budget, not a product timeout.
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['**/__tests__/**'],
    },
  },
})
