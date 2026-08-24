# Changelog

## 0.1.3

- Replaced the public repository and npm package overview with concise CLI and
  Visual Studio Code installation instructions.
- Linked the complete CLI guide and documented `pannonico manual` as the
  version-matched documentation entry point.

## 0.1.2

- Added seven public npm packages for the Pannonico Free command-line tool: the
  `pannonico` launcher and six optional platform-native packages.
- Bundled a verified WASI runtime in the launcher for unsupported hosts and
  unavailable native packages.
- Added version-pinned `npx` use and standalone native and WASI assets for
  Linux, macOS, and Windows.
- Added installed access to the complete version-matched user manual through
  `pannonico manual` and `pannonico manual --list`.

## 0.1.0

- First public release of Pannonico for VS Code.
- Added completion, hover, definitions, and conservative saved-workspace
  diagnostics for Pannonico projects.
- Added pinned, integrity-checked Pannonico language-server acquisition for
  trusted local and Remote-WSL workspaces.
