# Support

Use [GitHub Issues](https://github.com/vx-rs/pannonico/issues) for usage
questions, compatibility reports, and reproducible bugs. Search existing issues
before opening a new one.

For command-line or npm reports, include:

- the output of `pannonico --version`;
- whether Pannonico was installed globally with npm, run with `npx`, or
  downloaded as a standalone asset;
- Node and npm versions when either was used;
- operating system and architecture;
- whether the launcher selected a native package or its bundled WASI runtime;
- a minimal project and command that reproduce the behavior;
- relevant terminal output with credentials, personal data, private paths, and
  confidential project content removed.

Set `PANNONICO_LAUNCHER_DEBUG=1` only when runtime-selection details are useful.
Review and redact its output before attaching it.

For Visual Studio Code reports, include:

- Pannonico extension, VS Code, and WASM WASI Core versions;
- operating system, architecture, and whether the workspace is local or
  Remote-WSL;
- the project marker in use (`pannonico.yaml` or `.pannonico`);
- minimal reproduction steps, expected behavior, and actual behavior;
- relevant Pannonico Output-channel logs with credentials, personal data,
  private paths, and confidential project content removed.

Use the private process in [SECURITY.md](SECURITY.md) for suspected
vulnerabilities.
