# npm checks and installed acceptance

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run package:check
```

The API unit suites execute the authored TypeScript. `commands.test.ts` checks
every public function and applicable flag against independent CLI protocol
expectations. `process.test.ts` checks the Node process boundary, UTF-8 stream
draining through close, stdio modes, context isolation, exit classes, signals
and synchronous/asynchronous spawn failures. `api.test.ts` exercises a real
child fixture without loading a product binary.

`npm run test:coverage` writes the v8 HTML and JSON reports to ignored
`coverage/`. Inspect the `src/api` entries for API coverage separately from
the migrated launcher library. Fully covered files may be suppressed in the
default terminal report; they remain in the HTML and JSON reports.

Unit tests also cover CLI arguments, process output/error/lifetime behavior, parent
state isolation, package identity, native/WASI verification, fallback, closed
package sets, real npm tarballs, and offline installation. Package-check
verifies the maintainer runtime payload against its explicit allowlist.

Vitest uses the dot reporter with routine test console output silenced. Its
workers suppress Node's experimental WASI import warning; failures and their
diagnostics remain visible. Coverage runs additionally print the coverage report.

After [building package sets](../compilation-and-release/README.md), run:

```sh
npm run install:local:free
npm run test:installed:free
npm run install:local:pro
npm run test:installed:pro
```

These commands consume public-owner `.local` manifests and tarballs. Installation
uses only file dependencies, a fresh offline cache, and disabled lifecycle
scripts. Consumers do not rebuild or repair producer files.

Installed tests cover the CLI and a TypeScript consumer compiled against the
installed package's declarations, then executed as JavaScript. They exercise
native and forced-WASI API behavior, schema-v1 reports, dry-run, signing, MCP
initialization/EOF, and native Pro watch serving, rebuild, and POSIX shutdown.
A separate missing-native installation proves automatic fallback.

`PANNONICO_NPM_LOCAL_ROOT` selects an explicit maintainer artifact workspace for
private orchestration; runtime identity cannot be redirected with it. Generic
`install:local` and `test:installed` commands also take explicit manifest/install
paths. Record the actual host; cross-build metadata is not runtime proof.

Final release candidates are tested through `test:candidate:free` with the
explicit release environment supplied by the private CLI-track coordinator.
That route consumes unchanged candidate bytes and does not publish.
