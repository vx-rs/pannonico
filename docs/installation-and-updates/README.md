# Installation and updates

Pannonico 0.5 is not released yet. The source tree defines the candidate
installation paths below, but a source file or candidate package is not proof
that its public channel is available. Before installation, confirm that the
selected destination lists the intended version. Keep the CLI, manifest, and
runtime files on the same `0.5.x` version.

## npm

The npm launcher requires Node.js 24 or newer. After the matching npm release
is published, install Pannonico with:

```text
npm install --global pannonico@latest
```

Verify the installation before following the [quick start](../quick-start/README.md):

```text
pannonico --version
pannonico capabilities
```

The launcher verifies its selected native or WASI artifact against the
packaged manifest before execution. It uses native code on a supported host and
falls back to the bundled WASI module when a native package is unavailable.

## Standalone CLI assets

Each released CLI version has one immutable GitHub Release containing
`manifest.json`, native executables for the supported macOS, Linux, and Windows
targets, and `pannonico.wasm`. Download the manifest and exactly one runtime
from the same `v<version>` release.

Require the manifest's Free edition, exact version, full source revision, and
matching target record. Before execution, verify the downloaded filename, byte
size, lowercase SHA-256 digest, and executable mode against that record. The
standalone files are release assets only; they are not stored in the Git
repository or Git LFS.

## Editor integrations

Pannonico editor integrations have independent release tracks and select an
exact Pannonico LSP release:

- VS Code 1.100 or newer uses the `vx-rs.pannonico` extension in trusted,
  file-backed local, Remote-WSL, Remote-SSH, and Dev Container workspaces.
- Neovim 0.12.x uses the `vx-rs/pannonico-neovim` package and Neovim's built-in
  package and LSP support.
- JetBrains IDEs on IntelliJ Platform 2026.2, build branch 262, use the
  Pannonico plugin for that platform generation.

Install an editor adapter only after its Marketplace, GitHub Release, or tagged
repository destination lists the selected version. See
[language-server integration](../lsp/README.md) for setup and compatibility
details.

## Updating

Pannonico never replaces itself in the background. Update through the same
channel used for installation, then run:

```text
pannonico --version
pannonico capabilities
```

Update editor adapters through their owning Marketplace or package manager.
Each adapter release continues to use its reviewed, pinned LSP and runtime
identity; do not substitute a mutable `latest` download.

## Migrations

- [Migration from Handlebars](migration-from-handlebars.md)
