# Language-server integration

Pannonico's editor features use one edition-neutral Go language server built as
six native executables and a WASI module. Desktop plugins download their pinned
native target and verify its byte size, SHA-256 checksum, and executable format
before starting a project-scoped session. A plugin never needs access to Pannonico's private
source repository. Install the public extension from the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico).
Its pinned language-server bytes are available anonymously from immutable
[`pannonico-lsp` releases](https://github.com/vx-rs/pannonico-lsp/releases).

Read:

1. [Template navigation](../authoring/navigation.md) for navigation values,
   identifier encoding, completion, and definitions.
2. The extension requirements and commands below for supported workspaces and
   lifecycle control.
3. The release contract when diagnosing acquisition or cache failures.

## Extension requirements and scope

The current extension requires VS Code 1.100 or newer and a trusted file-backed
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

## Release contract

Each immutable `v<version>` release contains `manifest.json`,
`pannonico-lsp.wasm`, and native AMD64/ARM64 executables for macOS, Linux, and
Windows. The `lsp-release/v2` manifest identifies the product, version, source
revision, IDE contract, complete target set, kind, filename, executable mode,
byte size, and lowercase SHA-256 digest. A changed payload requires a new
version; consumers never use a mutable `latest` URL.

The extension compiles one reviewed release identity into its source. On first
use it downloads that exact HTTPS asset, follows
only bounded safe redirects, verifies the pinned identity, and installs it
atomically into versioned global storage. Later windows verify and reuse the
cache. The VSIX contains no LSP binary, release manifest, source repository
credential, or update channel.

Report language-server acquisition, protocol, diagnostic, or lifecycle bugs
in [`pannonico-lsp` Issues](https://github.com/vx-rs/pannonico-lsp/issues).
Report extension-specific behavior in
[`pannonico-vscode` Issues](https://github.com/vx-rs/pannonico-vscode/issues).
Suspected vulnerabilities use the shared
[private security form](https://github.com/vx-rs/pannonico/security/advisories/new),
not a public issue.
