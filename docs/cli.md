# Pannonico command-line interface

Pannonico Free is distributed through npm and as standalone release assets.
Use one version consistently when installing, reporting a problem, or
verifying downloaded files. The commands below use `0.1.1`.

## Install with npm

The npm launcher requires Node.js 24 or newer. A global installation provides
the `pannonico` command:

```sh
npm install --global pannonico@0.1.1
pannonico --version
```

To run one exact release without keeping a global installation:

```sh
npx --yes pannonico@0.1.1 --version
```

The launcher supports these native packages:

| Operating system | Architecture | Native npm package |
| --- | --- | --- |
| Linux | x64 | `@vx.rs/pannonico-linux-x64` |
| Linux | arm64 | `@vx.rs/pannonico-linux-arm64` |
| macOS | x64 | `@vx.rs/pannonico-darwin-x64` |
| macOS | arm64 | `@vx.rs/pannonico-darwin-arm64` |
| Windows | x64 | `@vx.rs/pannonico-win32-x64` |
| Windows | arm64 | `@vx.rs/pannonico-win32-arm64` |

The selected native package is optional because the `pannonico` package also
contains a WASI build. The launcher verifies version, edition, source revision,
target, file type, size, and SHA-256 identity before starting a runtime. It uses
the native executable when available and falls back to its bundled WASI file on
an unsupported host, when the optional native package is unavailable, or when
the operating system rejects the native executable before it starts.

A package identity, integrity, or declared executable-mode mismatch is an
error. The launcher also does not switch runtimes after a native process has
started. This prevents a command from running twice after it may have changed
files.

## Read the installed manual

The complete user manual is embedded in every native and WASI product, so its
content always matches the installed version. Use `pannonico manual` to print
the manual index, then list or read exact topics:

```sh
pannonico manual
pannonico manual --list
pannonico manual quick-start
pannonico manual authoring/configuration
```

The manual command reads embedded documentation and does not install or modify
project files.

## Download a standalone binary

The [`v0.1.1` GitHub Release](https://github.com/vx-rs/pannonico/releases/tag/v0.1.1)
contains the integrity [manifest](https://github.com/vx-rs/pannonico/releases/download/v0.1.1/manifest.json)
and these runtime files:

| Operating system or runtime | Architecture | Asset |
| --- | --- | --- |
| Linux | x64 | `pannonico-linux-x64` |
| Linux | arm64 | `pannonico-linux-arm64` |
| macOS | x64 | `pannonico-darwin-x64` |
| macOS | arm64 | `pannonico-darwin-arm64` |
| Windows | x64 | `pannonico-win32-x64.exe` |
| Windows | arm64 | `pannonico-win32-arm64.exe` |
| WASI Preview 1 | wasm | `pannonico.wasm` |

Compare the downloaded file's byte size and SHA-256 digest with its record in
`manifest.json` before running it. For example:

```sh
sha256sum pannonico-linux-x64
```

On macOS, use `shasum -a 256`. On Windows PowerShell, use
`Get-FileHash -Algorithm SHA256`. A POSIX download may not retain executable
permission; add it only after verifying the file:

```sh
chmod 0755 pannonico-linux-x64
./pannonico-linux-x64 --version
```

Choose the filename for your operating system and architecture. The raw WASI
asset is for compatible WASI Preview 1 hosts; the npm launcher already contains
and hosts the same WASI product when fallback is needed.

## Troubleshooting

- Confirm `node --version` reports Node 24 or newer for npm and `npx` use.
- Run `pannonico --version` to record the product version, edition, and selected
  target.
- Set `PANNONICO_LAUNCHER_DEBUG=1` for safe runtime-selection diagnostics. Set
  `PANNONICO_FORCE_WASI=1` to check the bundled WASI path explicitly.
- If an optional native package is missing, retry the versioned installation
  with a working registry connection. The bundled WASI runtime remains the
  supported fallback.
- If verification reports changed bytes or metadata, remove the installation,
  reinstall the exact version, and do not run an unverified standalone file.
- If a standalone POSIX binary reports permission denied, verify its digest and
  then apply the `chmod` command above.

For usage questions and reproducible bugs, follow the [support guide](../SUPPORT.md).
Report suspected vulnerabilities through the private process in the
[security policy](../SECURITY.md). Pannonico Free's terms are in the
[license chooser](../LICENSE).
