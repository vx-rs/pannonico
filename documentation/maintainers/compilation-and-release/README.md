# npm package construction

Go owns product compilation and manifests. This repository consumes explicit
existing product inputs and writes the npm package trees, tarballs, and manifest.
The generated version and binary sourceRevision come from the selected Go input;
the private maintainer manifest's version is not a separate release authority.

From this repository, after the Go producer has supplied its manifest:

```sh
npm run package:local:free -- --product-manifest /absolute/product/manifest.json --output-root .local/artifacts/dev/node/free
npm run package:local:pro -- --product-manifest /absolute/product/manifest.json --output-root .local/artifacts/dev/node/pro
```

Public-shape Free output and private development Pro output remain separate.
The generated `pannonico` launcher has six same-version optional native packages,
bundled `runtime/pannonico.wasm`, ESM root exports, and TypeScript declarations.
Only the API/runtime JS, declaration closure, reviewed legal files, README,
package metadata, and verified binary payloads enter generated tarballs.

Source tests use disposable fixture binaries. Real installed acceptance receives
the newly produced package manifest. See [testing](../testing/README.md).

The private CLI release coordinator retains the existing primary version,
clean-checkout, final-candidate, and publication boundaries. It calls this
owner's `package:release:free` and `test:candidate:free` commands with explicit
Go/package manifests and its artifact workspace through
`PANNONICO_NPM_LOCAL_ROOT`. Candidate production writes directly to the selected
CLI candidate's `npm/free` leaf; no intermediate assembly or source projection.

The source-only `@vx.rs/pannonico/release` facade exposes package verification
and tarball inspection to private tooling through a local development link.
It is not a supported import from the generated `pannonico` runtime package.

Production publication still needs the owner's explicit authorization and the
existing private CLI release procedure. Source changes and local acceptance
alone do not publish npm packages or GitHub Releases. Native/WASI executables
remain release artifacts and are never committed here.
