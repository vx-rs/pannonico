/**
 * The Node release API exposes only the package inspection and verification
 * operations required by root publication. Keeping this facade
 * separate prevents release orchestration from importing package-private build
 * and installation helpers.
 */
// Exports
// -----------------------------------------------------------------------------
export { inspectNpmTarball } from './package-set.js'
export { verifyPackageSet } from './package-set.js'
