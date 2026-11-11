// Vite runner
// -----------------------------------------------------------------------------

// Resolve Vite from this workspace package and import its CLI in the current
// Node process. Pannonico then owns the real development process on every host,
// including Windows, instead of owning a short-lived npm command shim.
const VITE_PACKAGE_URL = import.meta.resolve('vite/package.json')
const VITE_CLI_URL = new URL('bin/vite.js', VITE_PACKAGE_URL)

await import(VITE_CLI_URL.href)
