# Pannonico

## What is Pannonico?

Pannonico builds deterministic static sites from content, templates, data, and
assets. It is available as a command-line tool and as a Visual Studio Code
extension. The extension provides completion, hover, definitions, and
diagnostics for Pannonico projects.

## Install Pannonico

Pannonico requires Node.js 24 or newer.

```sh
npm install --global pannonico@latest
pannonico --version
```

## Documentation

Read the [CLI installation and usage guide](docs/cli.md).

The complete manual matching your installed version is also available from the
command line:

```sh
pannonico manual
```

## Visual Studio Code extension

Open [Pannonico in the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico)
and select **Install**, or search for `vx-rs.pannonico` in the VS Code
Extensions view. VS Code installs the required WASM WASI Core extension as a
dependency.
