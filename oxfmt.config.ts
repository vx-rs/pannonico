// Imports
// -----------------------------------------------------------------------------
// External
import { defineConfig } from 'oxfmt'

// Config
// -----------------------------------------------------------------------------
export default defineConfig({
  arrowParens: 'avoid',
  bracketSpacing: true,
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
    '**/*.md',
    '**/*.yaml',
    '**/*.yml',
    '**/*.vue',
    '**/*.snap',
  ],
  objectWrap: 'preserve',
  printWidth: 80,
  proseWrap: 'preserve',
  semi: false,
  singleQuote: true,
  sortImports: false,
  sortPackageJson: false,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
})
