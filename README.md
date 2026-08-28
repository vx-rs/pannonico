# Pannonico

Pannonico is a static site generator for simple sites, data-driven websites,
and modern frontend workflows with Vite.

> **Pre-1.0 development notice:** Pannonico is under active development. Until version 1.0.0, public contracts and user-visible behavior may change between releases. Expect breaking changes while the program and distribution model are being stabilized.

## What Pannonico does

Pannonico builds HTML and Markdown pages with Go templates, layouts, partials,
frontmatter, YAML/JSON data, localization, navigation, deterministic sitemaps,
HTML validation, image optimization, and atomic site output. It supports
zero-configuration sites, explicit configuration, Vite production assets, a
WASI fallback, MCP tools, and editor integration through the public Pannonico
language server and VS Code extension.

Pannonico includes bounded concurrency controls and benchmark infrastructure.
Representative public benchmark results have not yet been published, so this
repository makes no speed claim.

## Install

Install the latest Pannonico Free CLI with Node.js 24 or newer:

```sh
npm install --global pannonico@latest
pannonico --version
```

Matching standalone native and WASI binaries are attached only to versioned
[GitHub Releases](https://github.com/vx-rs/pannonico/releases). Binaries are not
committed to this Git repository and do not use Git LFS.

## Documentation

Browse the complete [user manual](docs/README.md). To copy the manual matching
an installed binary into a directory where relative links work, run:

```sh
pannonico manual --eject [root]
pannonico scaffold --with-docs [root]
```

Both commands write the same manual below `<root>/documentation/`.

## Editor support

- Install [Pannonico for VS Code](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico).
- Read the public [language-server integration contract](https://github.com/vx-rs/pannonico-lsp).

## Compatibility

Every published 0.x version and its documentation remain immutable, but a later
0.x release may introduce breaking changes. The changelog describes migration
steps. Strict cross-version compatibility begins with 1.0.0.

## Support, security, and licensing

Use [Pannonico Issues](https://github.com/vx-rs/pannonico/issues) for CLI
installation, invocation, scaffolding, builds, manual behavior, npm packages,
and standalone assets. Read [SUPPORT.md](SUPPORT.md) before filing a report.
Suspected vulnerabilities must use the private process in
[SECURITY.md](SECURITY.md), not a public issue.

Pannonico Free is available under either included PolyForm license, at your
option. See [LICENSE](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
