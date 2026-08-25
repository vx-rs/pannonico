# Pannonico 0.1.3 command-line guide

Pannonico Free 0.1.3 is distributed through npm. No standalone GitHub Release
was published for this CLI version; use npm rather than an absent release URL.

## Install with npm

The launcher requires Node.js 24 or newer:

```sh
npm install --global pannonico@0.1.3
pannonico --version
```

Run an exact release without retaining a global installation:

```sh
npx --yes pannonico@0.1.3 --version
```

The launcher supports Linux, macOS, and Windows on x64 and arm64 through the
matching `@vx.rs/pannonico-<platform>-<architecture>` package. Those packages
are optional because `pannonico` also contains a WASI Preview 1 fallback. The
launcher verifies version, edition, source revision, target, file type, size,
and SHA-256 identity before starting either runtime.

## Commands

- `pannonico scaffold [flags] [root]` creates a starter site.
- `pannonico build [flags] [root | page]` builds or dry-runs a site.
- `pannonico mcp [root]` serves built-in MCP tools over stdio.
- `pannonico capabilities` shows the compiled product capabilities.
- `pannonico --help` and `pannonico help <command>` show command usage.

Repository documentation is the linked, browsable reference for this release.

## Troubleshooting

- Confirm `node --version` reports Node 24 or newer.
- Record `pannonico --version`, the operating system, and architecture.
- Set `PANNONICO_LAUNCHER_DEBUG=1` only for runtime-selection diagnostics, and
  redact its output before sharing it.
- Reinstall the exact version if package verification reports changed bytes or
  metadata. Do not run an unverified artifact.

Use [Pannonico Issues](https://github.com/vx-rs/pannonico/issues) for CLI
reports. Suspected vulnerabilities use the private process in
[SECURITY.md](../SECURITY.md).
