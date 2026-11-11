// Imports
// -----------------------------------------------------------------------------
// External
import { defineConfig } from 'oxlint'

// Config
// -----------------------------------------------------------------------------
export default defineConfig({
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  ignorePatterns: [
    'coverage',
    'dist',
    '.local/**',
    'demo/.pannonico/**',
    'demo/dist/**',
    'demo/dist-native/**',
    'demo/dist-wasi/**',
    '**/node_modules/**',
    'node_modules',
    '**/*.html',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '**/*.vue',
    '**/*.snap',
  ],
  rules: {
    'no-console': 'off',
    'eslint/no-unused-vars': 'warn',
    'typescript/no-explicit-any': 'warn',
  },
})
