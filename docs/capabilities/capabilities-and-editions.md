# Capabilities and editions

Pannonico has two compile-time editions: Free and Pro. See the
[`Free vs Pro`](free-vs-pro.md) product comparison before using this technical
capability reference. Edition metadata is not a plugin system and is not loaded
from configuration or environment variables. Each concrete runtime declares
its name and effective capability contract beside the implementations it
composes.

Each compiled product owns immutable edition data used by product behavior:

- the stable edition name;
- the native or WASI target class;
- every known capability's availability and typed unavailable reason; and
- one ordered available-capability projection with stable names and schema
  versions.

The runtime owns its scheduler, Rich Markdown plugin set, CSS-inliner factory,
remote-data loader, beautifier, minifier, watcher, Vite process, and development
server hooks separately. Runtime construction validates capability/provider
parity before a request can run. Lower-level build services receive the same
capability requirement callback and cannot authorize themselves from an
injected provider alone.

All four Free/Pro native/WASI compositions include `mcp` version 1 and
`manual` and `scaffold` version 2. Manual/scaffold v2 adds the shared local
documentation ejection operation. The runtimes expose the same five MCP tool
schemas and installed-document resource scheme.
`pannonico capabilities` and MCP `inspect_project` use the same ordered
available projection. Version output and schema-v1 reports retain their
edition, product-version, and target metadata; they are not complete
capability discovery surfaces. MCP does not make an unavailable Pro or
native-only implementation available.

## Free

The standard Free product selects the Free runtime at compile time.

Free native includes the core build, scaffold, manual, localization, Markdown,
validation, sitemap generation, file routing, image optimization, atomic
output, parallel content preparation and rendering, Vite manifest, and managed
Vite process capabilities. Its page-worker default is the smaller of sixteen
and the host's logical CPU count; `--jobs` may select from one through that
logical-CPU count.

Image optimization includes a privacy property: when Pannonico selects a
smaller re-encoded JPEG or PNG, the replacement carries decoded image samples
but no source metadata. If the candidate is not smaller or a safety fallback
applies, Pannonico keeps the original bytes and does not claim that the image
was sanitized. See [Image optimization](../build-and-output/image-optimization.md)
for the exact metadata categories and preservation routes.

Free WASI declares the same product surface without `parallel-rendering` or
`vite-process`. It remains serial, can consume an existing Vite manifest, and
cannot execute Node or start Vite. Free and Pro use the same native
page-rendering and complete-tree publication worker policies. CPU,
artifact-count, and invocation limits still apply, but neither edition has a
product-specific worker ceiling.

Free uses base Markdown unless a project or page explicitly requests Rich
Markdown. An explicit request is recognized as a stable product option and
fails with `CAPABILITY_UNSUPPORTED` and status `4`. Free development uses an
explicit edit, build, and browser-refresh loop or an ordinary external server.
Free recognizes the shared `pannonico-inline-css` HTML directive, preserves the
selected stylesheet, removes the directive, and reports one warning. See
[`directives.md`](../authoring/directives.md) for the syntax shared by both editions.

## Pro

The Pro product selects the Pro runtime at compile time.

Pro native adds explicit Rich Markdown, HTML beautification, HTML minification,
generic CSS inlining, bounded HTTPS data, watch, development serving, and live
reload. It uses the same bounded native page scheduler and managed Vite process
behavior as Free native.
Pro WASI retains CSS inlining, Rich Markdown, both pure HTML transformations,
and `--jobs 1` but
omits native process, server, live-reload, parallel, remote-data, and watch
capabilities. A Pro WASI request for `--jobs` greater than one fails with status
`4` because parallel page work is unavailable on that target. Both Pro targets
compile the same Rich Markdown plugin set, but base Markdown remains the
default until project configuration or page frontmatter explicitly requests a
Rich Markdown feature. Pro has no additional publication-worker ceiling beyond
the thread and artifact formula unless the user supplies
`--max-output-workers` for an invocation.
The Rich Markdown composition links the Chroma lexer registry only into Pro;
Free still renders inline and fenced code through the edition-neutral base
renderer.
Pro executes the same directive as generic CSS inlining. The directive syntax
is not itself a capability or plugin registry; only the command behavior varies
by edition.

Native Pro's watcher, preview server, live reload, and configured Vite
development process form one Integrated development mode. They are available
together and are unavailable together. Managed Vite production remains a
separate native capability in both editions. The Free entrypoint does not
import Pro application composition. Target build constraints keep native Vite
and development implementations out of WASI builds.

## Changing a capability list

Edit only the concrete runtime that gains or loses behavior. Keep the list in
the user-visible canonical order. Do not add a registry, manifest, generator,
inheritance rule, or dependency resolver for a future edition.

After a change:

1. Run the complete Free and Pro suites.
2. Build Free native, Free WASI, Pro native, and Pro WASI.
3. Compare exact CLI and MCP capability discovery output.
4. Verify Free binaries do not link Pro implementations.
5. Verify WASI binaries do not link native Vite or watch implementations.
6. Run scaffold profiles and the native/WASI executable acceptance tests.

A future edition requires a concrete product and distribution need before it
changes this two-edition model.
