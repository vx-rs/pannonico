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

- **Category**: Project; **Functionality**: Zero-configuration project discovery; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Baseline project setup.

- **Category**: Project; **Functionality**: Strict configuration and confined paths; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Correctness and safety are not paid features.

- **Category**: Content; **Functionality**: HTML and Markdown pages; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both editions build the same baseline content.

- **Category**: Content; **Functionality**: Layouts, partials, templates, and helpers; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Core static-site generation.

- **Category**: Content; **Functionality**: Frontmatter and page controls; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Core content metadata.

- **Category**: Markdown; **Functionality**: Base Markdown and fenced code; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Base Markdown is the default in both editions.

- **Category**: Markdown; **Functionality**: Explicit Rich Markdown plugins; **Free**: No; **Pro**: Yes; **Availability and product boundary**: Pro adds anchors, footnotes, abbreviations, containers, highlighting, and inline extensions. An explicit Free request must return `CAPABILITY_UNSUPPORTED`.

- **Category**: Data; **Functionality**: Local and invocation-supplied YAML/JSON; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Local structured data is required for complete sites.

- **Category**: Data; **Functionality**: Remote HTTPS YAML/JSON; **Free**: No; **Pro**: Yes; **Availability and product boundary**: Native Pro automates bounded external data acquisition. It is unavailable under WASI.

- **Category**: Localization; **Functionality**: Catalogs, translated pages, and language links; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Content correctness remains shared.

- **Category**: Rendering; **Functionality**: Deterministic serial page rendering; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Shared baseline execution.

- **Category**: Rendering; **Functionality**: Parallel page rendering; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both native editions use the same bounded, configurable page-worker policy. WASI remains serial. Representative public benchmark results have not yet been published.

- **Category**: Output; **Functionality**: HTML generation; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Free output is complete and production-ready.

- **Category**: Output; **Functionality**: Deterministic sitemap generation; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both editions and native/WASI targets publish the same `sitemap.xml` for the same rendered routes.

- **Category**: Output; **Functionality**: Opt-in Signed Resources; **Free**: No; **Pro**: Yes; **Availability and product boundary**: Pro signs hashes of finished files with Ed25519; Free rejects an enabled request. Both Pro targets can sign when keys are readable.

- **Category**: Output; **Functionality**: HTML validation; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Validation is a correctness feature.

- **Category**: Output; **Functionality**: HTML beautification; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Optional readable-output transformation on native and WASI.

- **Category**: Output; **Functionality**: HTML minification; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Optional conservative HTML transformation on native and WASI.

- **Category**: Output; **Functionality**: CSS inlining; **Free**: Warning fallback; **Pro**: Yes; **Availability and product boundary**: Both editions recognize the [`pannonico-inline-css` directive](../authoring/directives.md). Free preserves working stylesheet behavior and emits a warning; Pro performs the requested inlining.

- **Category**: Assets; **Functionality**: Pass-through files and generated JSON/Vite artifacts; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Complete static output remains shared.

- **Category**: Assets; **Functionality**: Ordered `.pannonico` file routing; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both editions support `pannonico`, `copy`, `vite`, and `exclude` rules within configured source roots. Users can place third-party assets under a source root such as `pages/assets/vendor/` and route them explicitly.

- **Category**: Assets; **Functionality**: Default same-path JPEG and PNG optimization; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both editions optimize Pannonico-owned `.jpg`, `.jpeg`, and `.png` assets and remove source metadata, including EXIF and GPS data, from selected smaller web outputs. Reports and MCP builds list removed metadata categories once as build information; gain-map removal publishes the base SDR image. Exact `.pannonico` `copy` routes remain byte-identical, and `images.optimize: false` disables optimization project-wide.

- **Category**: Publishing; **Functionality**: Atomic complete-tree publication and safe additive output; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Publication safety remains shared.

- **Category**: Publishing; **Functionality**: Publication worker policy without an edition ceiling; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both native editions use the same bounded staged-file publication policy, independently of page-rendering concurrency.

- **Category**: Vite; **Functionality**: Manifest consumption and template metadata; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Both editions work with Vite-produced assets.

- **Category**: Vite; **Functionality**: Managed Vite production build; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Available on native targets. WASI consumes a prebuilt manifest.

- **Category**: Development; **Functionality**: Integrated development mode; **Free**: No; **Pro**: Yes; **Availability and product boundary**: Native Pro provides automatic rebuilds, a preview server, live browser reload, a managed configured Vite development server, and preservation of the last working preview after failed builds. Free uses explicit build and browser-refresh steps.

- **Category**: Automation; **Functionality**: Dry run; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Baseline CI and correctness workflow.

- **Category**: Automation; **Functionality**: Schema-v1 JSON reports; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Basic machine integration remains an adoption feature.

- **Category**: Tooling; **Functionality**: Stable diagnostics, progress, and exit classes; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Unavailable paid features use a capability diagnostic rather than pretending the option is unknown.

- **Category**: Tooling; **Functionality**: Scaffolding, embedded manuals, help, and capability discovery; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Onboarding and self-description remain shared.

- **Category**: Tooling; **Functionality**: Built-in MCP tools and installed documentation; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: MCP uses the capabilities of the compiled edition; it is not a separate paid product.

- **Category**: Reproducibility; **Functionality**: `SOURCE_DATE_EPOCH` and build metadata; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Predictable output remains shared.

- **Category**: Portability; **Functionality**: WASI baseline; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: WASI provides process-independent shared behavior. Individual native-only capabilities remain unavailable by target.

- **Category**: Usage; **Functionality**: Free license choice; **Free**: Yes; **Pro**: No; **Availability and product boundary**: Pannonico Free is available under either the PolyForm Noncommercial License 1.0.0 or the PolyForm Small Business License 1.0.0, at the user's option. Use not permitted by either requires a separate commercial Pannonico license. Pro requires separate paid Pro or commercial terms.

- **Category**: Usage; **Functionality**: User ownership of generated output; **Free**: Yes; **Pro**: Yes; **Availability and product boundary**: Generated sites have no Pannonico runtime or licensing requirement under the accepted policy.


## Pro value groups

### Developer-time savings

- Integrated development mode
- Remote HTTPS data

### Advanced content

- Explicit Rich Markdown plugins

### Advanced output transformations

- CSS inlining
- Signed Resources

## Target notes

- Native Free and Pro can run managed Vite production builds.
- Sitemap generation, file routing, and JPEG/PNG optimization are available in Free and Pro on
  native and WASI targets.
- Parallel page rendering is available in both native editions. Integrated
  development mode and remote HTTPS data are native Pro capabilities.
- Both WASI editions support HTML beautification and minification. Pro WASI
  also retains Rich Markdown and CSS inlining. Neither target can provide child
  processes, network data, or native development automation.
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
