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
language server and plugins for VS Code, Neovim, and supported JetBrains
IDEs.

In Pannonico Free, native `pannonico watch` serves a local preview and reloads
the browser when output changes. It can also start the site's Vite dev server.
Free builds support `--beautify` and `--minify` on native and WASI.

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

## JavaScript and TypeScript API

Pannonico 0.8.0 adds a typed API that runs the npm package's verified CLI
binaries.

Install the package in your project and call it from an ESM script with Node.js
24 or newer. JavaScript and TypeScript use the same imports:

```sh
npm install --save-dev pannonico@^0.8.0
```

```ts
import { build } from 'pannonico'

const result = await build({ root: './site', out: './dist', minify: true })
console.log(result.stdout)
```

`build` runs the installed package's binary and returns `exitCode`, `signal`,
`stdout`, and `stderr`. Use `beautify: true` for readable HTML or `minify: true`
for compact output. Use `dryRun: true` to validate without publishing output.
Failed commands reject with `PannonicoError`; its `result` retains diagnostics.
Other exports include `scaffold`, `manual`, `capabilities`, `version`, `help`,
`signingDns`, `watch`, and `mcp`.

See the [programmatic API manual](https://github.com/vx-rs/pannonico/blob/master/documentation/user-manual/programmatic-api.md)
for all commands, flag mappings, errors, reports, and watch/MCP process handles.

## Documentation

Browse the complete [user manual](https://github.com/vx-rs/pannonico/blob/master/docs/README.md). To copy the manual matching
an installed binary into a directory where relative links work, run:

```sh
pannonico manual --eject [root]
pannonico scaffold --with-docs [root]
```

Both commands write the same manual below `<root>/documentation/`.

## Editor support

- Install [Pannonico for VS Code](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico).
- Install [Pannonico for Neovim](https://github.com/vx-rs/pannonico-neovim)
  with your plugin manager. It requires Neovim 0.12 or newer within 0.x.
- Follow the installation instructions for [Pannonico for JetBrains IDEs](https://github.com/vx-rs/pannonico-jetbrains).
  The plugin requires IntelliJ Platform 2026.2 (build 262) or newer and works
  with the free tier of IntelliJ IDEA.
- Read the public [language-server integration contract](https://github.com/vx-rs/pannonico-lsp).

## Compatibility

Go-built native binaries support macOS 13 Ventura or newer on x64 and arm64.
macOS 12 and older are unsupported.

Every published 0.x version and its documentation remain immutable, but a later
0.x release may introduce breaking changes. The changelog describes migration
steps. Strict cross-version compatibility begins with 1.0.0.

## Support, security, and licensing

Use [Pannonico Issues](https://github.com/vx-rs/pannonico/issues) for CLI
installation, invocation, scaffolding, builds, manual behavior, npm packages,
and standalone assets. Read [SUPPORT.md](https://github.com/vx-rs/pannonico/blob/master/SUPPORT.md) before filing a report.
Report suspected vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/vx-rs/pannonico/security/advisories/new).
Read the security policy before reporting.

Pannonico Free is available under either included PolyForm license, at your
option. See [LICENSE](https://github.com/vx-rs/pannonico/blob/master/LICENSE). Changes are recorded in [CHANGELOG.md](https://github.com/vx-rs/pannonico/blob/master/CHANGELOG.md).
