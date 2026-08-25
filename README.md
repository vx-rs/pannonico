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

Pannonico 0.1.3 is available through npm and requires Node.js 24 or newer:

```sh
npm install --global pannonico@0.1.3
pannonico --version
```

The launcher selects a matching native package when available and otherwise
uses its bundled WASI Preview 1 product. See the [CLI guide](docs/cli.md) for
installation, integrity, command, and troubleshooting details.

## Editor support

- Install [Pannonico for VS Code](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico).
- Read the public [language-server integration contract](https://github.com/vx-rs/pannonico-lsp).

## Compatibility

Every published 0.x version and its documentation remain immutable, but a later
0.x release may introduce breaking changes. Release notes describe migration
steps. Strict cross-version compatibility begins with 1.0.0.

## Support, security, and licensing

Use [Pannonico Issues](https://github.com/vx-rs/pannonico/issues) for CLI
installation, invocation, scaffolding, build, and npm reports. Read
[SUPPORT.md](SUPPORT.md) before filing a report. Suspected vulnerabilities must
use the private process in [SECURITY.md](SECURITY.md), not a public issue.

Pannonico Free is available under either included PolyForm license, at your
option. See [LICENSE](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
