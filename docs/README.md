# Pannonico user manual

Read these areas in order when adopting Pannonico. Experienced users can jump
directly to the relevant contract.

1. [Quick start](quick-start/README.md) - scaffold and build a first site.
2. [Installation and updates](installation-and-updates/README.md) - choose one
   of the distribution paths that currently exists.
3. [Capabilities and editions](capabilities/README.md) - compare Free, Pro,
   native, and WASI behavior.
4. [Authoring](authoring/README.md) - configure data, templates, Markdown,
   localization, and navigation.
5. [Build and output](build-and-output/README.md) - understand discovery,
   routing, validation, optimization, and publication.
6. [Examples](examples/README.md) - inspect runnable sites and migrations.
7. [Vite](vite/README.md) - add frontend compilation and development flows.
8. [MCP](mcp/README.md) - expose project inspection to an MCP client.
9. [LSP](lsp/README.md) - use editor navigation and diagnostics.
10. [Reference](reference/README.md) - look up commands, diagnostics, and
    report fields.

## Installed access

This complete user manual is compiled into each native and WASI product.

Run either command to write the version-matched manual below
`<root>/documentation/`, where Markdown links work normally:

```text
pannonico manual --eject [root]
pannonico scaffold --with-docs [root]
```

Existing documentation files are not replaced by `manual --eject`. Scaffold
`--force --with-docs` may replace only known scaffold and manual files; it
never deletes unrelated content.

The built-in MCP server exposes individual Markdown resources on demand.
`README.md` maps to
`pannonico://docs`, an area `README.md` maps to
`pannonico://docs/<area>`, and another Markdown file maps to its path without
`.md`, such as `pannonico://docs/authoring/configuration`. Compatibility names
from the earlier flat manual, including `getting-started` and `templates`,
remain available through MCP.
