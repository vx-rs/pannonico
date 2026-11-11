# MCP through WASI

Forced and automatic WASI selection support the built-in MCP server:

```text
PANNONICO_FORCE_WASI=1 npx pannonico mcp
PANNONICO_FORCE_WASI=1 npx pannonico mcp ./site
```

The launcher validates one real, non-root, non-symlink project directory and
preopens it as `/project`. It passes the guest arguments as `mcp /project`.
Exact `mcp --help` and `mcp -h` invocations need no filesystem preopen.

Unknown flags, extra roots, files, filesystem roots, missing directories, and
paths containing a symlink fail before WASI module compilation. The MCP process
receives no ambient environment or additional preopens.

The [canonical MCP contract](../../../docs/mcp/README.md)
defines tools, resources, result semantics, and the server trust boundary.
