# Pannonico Free vs Pro

## Product definition

**Pannonico Free** is a complete static-site generator when use is permitted by
either of its Free licenses.

**Pannonico Pro** adds integrated development automation, bounded external
data, advanced content, and output transformations. Pro always
requires separately approved paid Pro or commercial terms; eligibility for a
Free license does not grant Pro entitlement.

The governing rule is:

> Free must be complete in what it can build. Pro may add automation and
> optional content and output transformations.

## Functionality comparison

| Category | Functionality | Free | Pro | Availability and product boundary |
| --- | --- | ---: | ---: | --- |
| Project | Zero-configuration project discovery | Yes | Yes | Baseline project setup. |
| Project | Strict configuration and confined paths | Yes | Yes | Correctness and safety are not paid features. |
| Content | HTML and Markdown pages | Yes | Yes | Both editions build the same baseline content. |
| Content | Layouts, partials, templates, and helpers | Yes | Yes | Core static-site generation. |
| Content | Frontmatter and page controls | Yes | Yes | Core content metadata. |
| Markdown | Base Markdown and fenced code | Yes | Yes | Base Markdown is the default in both editions. |
| Markdown | Explicit Rich Markdown plugins | No | Yes | Pro adds anchors, footnotes, abbreviations, containers, highlighting, and inline extensions. An explicit Free request must return `CAPABILITY_UNSUPPORTED`. |
| Data | Local and invocation-supplied YAML/JSON | Yes | Yes | Local structured data is required for complete sites. |
| Data | Remote HTTPS YAML/JSON | No | Yes | Native Pro automates bounded external data acquisition. It is unavailable under WASI. |
| Localization | Catalogs, translated pages, and language links | Yes | Yes | Content correctness remains shared. |
| Rendering | Deterministic serial page rendering | Yes | Yes | Shared baseline execution. |
| Rendering | Parallel page rendering | Yes | Yes | Both native editions use the same bounded, configurable page-worker policy. WASI remains serial. Representative public benchmark results have not yet been published. |
| Output | HTML generation | Yes | Yes | Free output is complete and production-ready. |
| Output | Deterministic sitemap generation | Yes | Yes | Both editions and native/WASI targets publish the same `sitemap.xml` for the same rendered routes. |
| Output | HTML validation | Yes | Yes | Validation is a correctness feature. |
| Output | HTML beautification | No | Yes | Optional readable-output transformation and secondary Pro value. |
| Output | HTML minification | No | Yes | Optional production transformation. |
| Output | CSS inlining | Warning fallback | Yes | Both editions recognize the [`pannonico-inline-css` directive](../authoring/directives.md). Free preserves working stylesheet behavior and emits a warning; Pro performs the requested inlining. |
| Assets | Pass-through files and generated JSON/Vite artifacts | Yes | Yes | Complete static output remains shared. |
| Assets | Ordered `.pannonico` file routing | Yes | Yes | Both editions support `pannonico`, `copy`, `vite`, and `exclude` rules within configured source roots. Users can place third-party assets under a source root such as `pages/assets/vendor/` and route them explicitly. |
| Assets | Default same-path JPEG and PNG optimization | Yes | Yes | Both editions optimize Pannonico-owned `.jpg`, `.jpeg`, and `.png` assets and remove source metadata, including EXIF and GPS data, from selected smaller web outputs. Reports and MCP builds list removed metadata categories once as build information; gain-map removal publishes the base SDR image. Exact `.pannonico` `copy` routes remain byte-identical, and `images.optimize: false` disables optimization project-wide. |
| Publishing | Atomic complete-tree publication and safe additive output | Yes | Yes | Publication safety remains shared. |
| Publishing | Publication worker policy without an edition ceiling | Yes | Yes | Both native editions use the same bounded staged-file publication policy, independently of page-rendering concurrency. |
| Vite | Manifest consumption and template metadata | Yes | Yes | Both editions work with Vite-produced assets. |
| Vite | Managed Vite production build | Yes | Yes | Available on native targets. WASI consumes a prebuilt manifest. |
| Development | Integrated development mode | No | Yes | Native Pro provides automatic rebuilds, a preview server, live browser reload, a managed configured Vite development server, and preservation of the last working preview after failed builds. Free uses explicit build and browser-refresh steps. |
| Automation | Dry run | Yes | Yes | Baseline CI and correctness workflow. |
| Automation | Schema-v1 JSON reports | Yes | Yes | Basic machine integration remains an adoption feature. |
| Tooling | Stable diagnostics, progress, and exit classes | Yes | Yes | Unavailable paid features use a capability diagnostic rather than pretending the option is unknown. |
| Tooling | Scaffolding, embedded manuals, help, and capability discovery | Yes | Yes | Onboarding and self-description remain shared. |
| Tooling | Built-in MCP tools and installed documentation | Yes | Yes | MCP uses the capabilities of the compiled edition; it is not a separate paid product. |
| Reproducibility | `SOURCE_DATE_EPOCH` and build metadata | Yes | Yes | Predictable output remains shared. |
| Portability | WASI baseline | Yes | Yes | WASI provides process-independent shared behavior. Individual native-only capabilities remain unavailable by target. |
| Usage | Free license choice | Yes | No | Pannonico Free is available under either the PolyForm Noncommercial License 1.0.0 or the PolyForm Small Business License 1.0.0, at the user's option. Use not permitted by either requires a separate commercial Pannonico license. Pro requires separate paid Pro or commercial terms. |
| Usage | User ownership of generated output | Yes | Yes | Generated sites have no Pannonico runtime or licensing requirement under the accepted policy. |

## Pro value groups

### Developer-time savings

- Integrated development mode
- Remote HTTPS data

### Advanced content

- Explicit Rich Markdown plugins

### Advanced output transformations

- HTML minification
- HTML beautification
- CSS inlining

## Target notes

- Native Free and Pro can run managed Vite production builds.
- Sitemap generation, file routing, and JPEG/PNG optimization are available in Free and Pro on
  native and WASI targets.
- Parallel page rendering is available in both native editions. Integrated
  development mode and remote HTTPS data are native Pro capabilities.
- Pro WASI retains pure transformations such as Rich Markdown, minification,
  beautification, and CSS inlining. It cannot provide child processes, network
  data, or native development automation.
- Target limitations and edition limitations are reported separately.

## Free onboarding principle

Free development is an explicit loop: edit source, run `pannonico build`, then
refresh the browser or use an ordinary external static-file server. This is a
complete production workflow. Pro Integrated development mode automates the
rebuild, preview, and reload loop without changing what Free can publish.

## Technical references

For the technical contract and machine-facing discovery, read
[`capabilities-and-editions.md`](capabilities-and-editions.md). For Pro runtime
details, read [`pro-capabilities.md`](pro-capabilities.md).
