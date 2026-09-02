# Language-server integration

Pannonico's editor features use the edition-neutral Go/WASI language server.
VS Code, Neovim, and JetBrains adapters select one pinned module and verify its
declared byte size, SHA-256 checksum, and WASM identity before starting a
project-scoped session. An adapter never needs access to Pannonico's private
source repository. The language-server bytes come from immutable
[`pannonico-lsp` releases](https://github.com/vx-rs/pannonico-lsp/releases).

Read:

1. [Template navigation](../authoring/navigation.md) for navigation values,
   identifier encoding, completion, and definitions.
2. The adapter requirements below for supported workspaces, platform
   generations, and lifecycle control.
3. The release contract when diagnosing acquisition or cache failures.

## VS Code

The current adapter requires VS Code 1.100 or newer and a trusted file-backed
local, Remote-WSL, Remote-SSH, or Dev Container workspace. It discovers regular
`pannonico.yaml` and `.pannonico` project markers; a markerless workspace can be
selected manually. Codespaces, other remote providers, Restricted Mode,
virtual workspaces, and VS Code for the Web are not supported.

Each marked project receives an isolated language-server process. Sibling and
nested projects use separate sessions, and the deepest marked root owns a file.
The Pannonico Output channel reports release identity, project roots, session
identity, timings, diagnostics, and lifecycle errors.

The contributed commands are:

- `Pannonico: Start Language Server`
- `Pannonico: Restart Language Server`
- `Pannonico: Restart All Language Servers`
- `Pannonico: Stop Language Servers`
- `Pannonico: Show Output`

Start discovers marked projects. Restart targets the active editor's project
when ownership is unambiguous; Restart All rediscovers the workspace.

Install `vx-rs.pannonico` from the Visual Studio Marketplace only after the
selected extension version is published. The extension downloads and verifies
its pinned LSP on first project use. In a supported remote window, install both
Pannonico and WASM WASI Core in the workspace extension group.

## Neovim

The current adapter supports Neovim 0.12.x only and uses Neovim's built-in
package manager and LSP lifecycle. It does not depend on `nvim-lspconfig` or
Mason. Git and Neovim 0.12.5 are required by the current 0.5 candidate.

After a matching immutable `0.5.x` tag is published, add the adapter in
`init.lua`:

```lua
vim.pack.add({
  {
    src = 'https://github.com/vx-rs/pannonico-neovim',
    version = vim.version.range('0.5'),
  },
})

require('pannonico').setup()
```

Restart Neovim after the initial install. Open an HTML or Markdown file below
a root containing `pannonico.yaml` or `.pannonico`. Use `:PannonicoStatus` and
`:PannonicoRestart` for lifecycle diagnosis.

The current adapter selects `pannonico-lsp.wasm` 0.5.0 and official Wasmtime
48.0.1. It downloads and verifies both when matching local overrides are not
configured. The adapter supports the host targets declared by its pinned
runtime manifest; it does not resolve a mutable Wasmtime release.

## JetBrains IDEs

The current plugin supports IntelliJ Platform 2026.2, build branch 262, only:

```text
sinceBuild = 262
untilBuild = 262.*
```

The plugin starts its exact pinned `pannonico-lsp.wasm` through verified
Wasmtime 48.0.1 for each root containing `pannonico.yaml` or `.pannonico`.
HTML and Markdown use the IDE's platform language support. The plugin ZIP
contains neither the LSP nor Wasmtime.

After Marketplace publication, install Pannonico through the IDE's Plugins
settings. Before Marketplace approval, an explicitly provided matching GitHub
Release ZIP can be installed with **Install Plugin from Disk** without
extracting or repackaging it. A candidate file in the source tree is not a
published installation path.

## Release contract

Each immutable `v<version>` LSP release contains exactly `pannonico-lsp.wasm` and
`manifest.json`. The schema-1 manifest identifies the product, version, source
revision, IDE contract, `wasip1-wasm` target, filename, byte size, and lowercase
SHA-256 digest. A changed payload requires a new version; consumers never use a
mutable `latest` URL.

Each editor adapter compiles one reviewed LSP release identity into its source.
The adapter verifies the exact HTTPS asset before use and keeps versioned cache
entries separate. VS Code uses its WASI host directly. Neovim and JetBrains
execute the same WASM through the exact Wasmtime release selected by their
source. None of the editor packages contains the LSP WASM, Wasmtime, source
repository credentials, or a mutable update channel.

Report language-server acquisition, protocol, diagnostic, or lifecycle bugs
in [`pannonico-lsp` Issues](https://github.com/vx-rs/pannonico-lsp/issues).
Report VS Code-specific behavior in
[`pannonico-vscode` Issues](https://github.com/vx-rs/pannonico-vscode/issues).
Report Neovim-specific behavior in
[`pannonico-neovim` Issues](https://github.com/vx-rs/pannonico-neovim/issues),
and JetBrains-specific behavior in
[`pannonico-jetbrains` Issues](https://github.com/vx-rs/pannonico-jetbrains/issues).
Suspected vulnerabilities use the shared
[private security form](https://github.com/vx-rs/pannonico/security/advisories/new),
not a public issue.
