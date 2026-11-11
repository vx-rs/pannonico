# npm development workflow

Work in the public `pannonico` checkout. Node.js 24 or newer is required.
The root maintainer package is `@vx.rs/pannonico` with `private: true`; the
builder produces the installable `pannonico` package and optional native packages.

```sh
npm ci --ignore-scripts
npm run check
```

`src/` owns runtime TypeScript. `src/index.ts` explicitly exports the supported
API. `scripts/` owns package production, validation, and installed acceptance.
Tests use Vitest in `__tests__`; source/package checks work without private Go
source. The demo is a private workspace with its own declared development inputs.

The build replaces its ignored dist tree so removed modules cannot enter a
later tarball. Strict NodeNext TypeScript emits runtime JS to `dist/js`, declarations to
`dist/types`, and maintainer tooling to `dist/tools`. Use `.js` import specifiers
in authored TypeScript. Keep labeled import groups, two-line sections, uppercase
module constants, callable/API documentation, and behavior/condition test names.
Oxlint and Oxfmt own lint and formatting. Build outputs and artifacts are ignored.

Real packaging requires a producer manifest and the exact referenced binaries.
Pass these as explicit arguments; the builder does not compile the Go engine.
See [compilation](../compilation-and-release/README.md) and
[installed acceptance](../testing/README.md).

Private source orchestration may link this maintainer package through a local
file dependency and use its `./release` verification facade. It does not retain
or synchronize npm implementation. The facade is absent from runtime tarballs.
