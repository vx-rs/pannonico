# Pannonico

Pannonico builds deterministic static sites and provides project intelligence
for Pannonico sites in Visual Studio Code. The command-line tool is available
through npm or as standalone Free binaries. The extension runs a pinned
Pannonico language server through WASI and verifies the downloaded module
before starting it.

## Command-line interface

Install the versioned npm package globally:

```sh
npm install --global pannonico@0.1.1
pannonico --version
```

Or run the same release without a global installation:

```sh
npx --yes pannonico@0.1.1 --version
```

See the [CLI installation and usage guide](docs/cli.md) for supported
platforms, native and bundled-WASI behavior, integrity verification, the
embedded user manual, and troubleshooting. Standalone binaries are available
from the [`v0.1.1` GitHub Release](https://github.com/vx-rs/pannonico/releases/tag/v0.1.1).

## Visual Studio Code extension

Install **Pannonico** from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico),
or search for extension ID `vx-rs.pannonico` in VS Code. The required
[WASM WASI Core](https://marketplace.visualstudio.com/items?itemName=ms-vscode.wasm-wasi-core)
extension is declared as a dependency.

For an exact-byte fallback, download `pannonico.vsix` from the
[`vscode-v0.1.0` GitHub Release](https://github.com/vx-rs/pannonico/releases/tag/vscode-v0.1.0)
and install it with **Extensions: Install from VSIX...**.

### Supported environments

Pannonico supports VS Code 1.91 or newer in trusted, file-backed local and
Remote-WSL workspaces. Remote-SSH, Dev Containers, Codespaces, other remote
providers, Restricted Mode, virtual workspaces, and VS Code for the Web are not
supported in this release.

The extension provides completion, hover, definitions, and conservative
saved-workspace diagnostics for Pannonico projects. See the packaged extension
README in VS Code for commands, project discovery, language behavior, and
current limits.

### Language server

The edition-neutral language-server module and its integrity manifest are
distributed as immutable releases from
[`vx-rs/pannonico-lsp`](https://github.com/vx-rs/pannonico-lsp). The extension
downloads only its pinned release and verifies its filename, size, SHA-256
digest, and WASM format before use.

## License

Pannonico Free is available under either the
[PolyForm Noncommercial License 1.0.0](LICENSES/PolyForm-Noncommercial-1.0.0.md)
or the
[PolyForm Small Business License 1.0.0](LICENSES/PolyForm-Small-Business-1.0.0.md),
at your option. Organizations whose use is not permitted by either license
require a separate commercial Pannonico license. See [LICENSE](LICENSE).

## Support and security

Use the [support guide](SUPPORT.md) for questions and reproducible bug reports.
Report suspected vulnerabilities through the private process in
[SECURITY.md](SECURITY.md), not through a public issue.
