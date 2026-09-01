# Installation and updates

Pannonico requires Node.js 24 or newer. Install the current command-line release
from npm:

```text
npm install --global pannonico@latest
```

Verify the installation before following the [quick start](../quick-start/README.md):

```text
pannonico --version
pannonico capabilities
```

The npm launcher verifies its selected native or WASI artifact against the
packaged manifest before execution. It uses native code on a supported host and
falls back to the bundled WASI module when a native package is unavailable.

## Standalone CLI 0.3.0

Pannonico Free 0.3.0 is also distributed as immutable GitHub Release assets.
Download the manifest and exactly one runtime for the target host:

- [`manifest.json`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/manifest.json)
- [`pannonico-darwin-arm64`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico-darwin-arm64)
- [`pannonico-darwin-x64`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico-darwin-x64)
- [`pannonico-linux-arm64`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico-linux-arm64)
- [`pannonico-linux-x64`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico-linux-x64)
- [`pannonico-win32-arm64.exe`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico-win32-arm64.exe)
- [`pannonico-win32-x64.exe`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico-win32-x64.exe)
- [`pannonico.wasm`](https://github.com/vx-rs/pannonico/releases/download/v0.3.0/pannonico.wasm)

Require the manifest's Free edition, version `0.3.0`, full source revision, and
matching target record. Before execution, verify the downloaded filename, byte
size, lowercase SHA-256 digest, and executable mode against that record. Keep
the manifest and runtime from the same immutable release. The standalone files
are Release assets only; they are not stored in the Git repository or Git LFS.

Install the Pannonico editor extension from the
[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico),
or search for `vx-rs.pannonico` in the VS Code Extensions view. The extension
downloads and verifies the exact pinned Pannonico LSP WASM on first use.

Pannonico never replaces itself in the background. Update the CLI by running the
npm installation command again. Update the extension through VS Code.

## Migrations

- [Migration from Handlebars](migration-from-handlebars.md)
