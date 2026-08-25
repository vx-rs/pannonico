# WASI runtime

Pannonico Free and Pro can run as `wasip1/wasm` modules when a compatible
preview1 host preopens one project directory. The distribution's launcher owns
the host command, maps the selected real directory to the guest path
`/project`, preserves standard streams and exit status, and passes only
approved environment values. The current approved environment value is
`SOURCE_DATE_EPOCH`.

The WASI process cannot infer the host working directory or access paths
outside its preopen. Product arguments inside the guest use `/project`.
Relative and absolute paths supplied to a launcher must remain confined to the
selected project, and Pannonico's normal symlink and regular-file checks still
apply inside it.

Free WASI supports build, dry run, JSON reports, scaffold, local manual
ejection, MCP stdio, and capability metadata. Bare/help manual forms require
no preopen. `manual --eject` receives one selected writable root, while
`scaffold --with-docs` reuses the scaffold root. Pro WASI also supports HTML
beautification and minification. It accepts `--jobs 1`; a larger value requests
unavailable parallel rendering and exits with capability status `4` before
project work. Watch, the development server, live reload, remote HTTPS data,
and native Integrated development mode are unavailable.

WASI can load `--data` only when the selected directory remains inside its one
preopen. Neither edition exposes `--data-url` on WASI. Configured `data.urls`
returns capability status `4` before rendering.

WASI consumes prebuilt Vite output because it cannot start Node.js. When a
production configuration contains `buildCommand`, a non-dry-run build emits
one `VITE_COMMAND_SKIPPED_TARGET` warning and uses a valid existing manifest.
Missing or stale manifests still fail. Dry run remains process-free and does
not emit that target warning.

An MCP session through WASI uses the same five tools and installed user-manual
resources as the native product. Its project operations remain confined to the
preopened root and the capabilities compiled into the WASI module.
