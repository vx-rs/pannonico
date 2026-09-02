# Changelog

## Unreleased

Every entry in this section starts with **CLI**, **LSP**, or **CLI and LSP**.
An independent release moves only its selected track's entries into that
track's version subsection.

## 0.5.0

### CLI

#### Public changes

- Moved the CLI to the shared 0.5 release line.

## 0.4.0

### CLI

#### Public changes

- Reduced native build overhead by scheduling source content loading and page
  template preparation through the existing worker bound and by skipping
  Markdown action parsing when no action opener is present. WASI behavior,
  language-server indexing, output bytes, and diagnostic ordering remain
  unchanged.
- Made bounded native page rendering and `--jobs` shared Free and Pro behavior.
  Both editions now default to the smaller of sixteen workers and the host's
  logical CPU count and accept the same explicit range. Native staged-file
  publication now uses thirty-two I/O workers per available Go execution
  thread in both editions. Both WASI products remain serial.
- Made the audience-organized user manual the single installed documentation
  source for native and WASI binaries. The CLI and MCP now expose its complete
  hierarchy without source-repository access, retain earlier flat topic names
  as compatibility aliases, and exclude maintainer documentation from the
  compiled resource boundary.
- Added default-on deterministic `sitemap.xml` generation in the existing
  configuration and report version 1. Projects configure an absolute
  `site.url`, may explicitly disable generation, and may exclude individual
  rendered pages with `pannonico.sitemap.exclude` without suppressing page
  output. Public routes distinguish root/nested index pages, sitemap output is
  included in atomic publication and collision checks, and CLI/MCP/report
  surfaces expose planned and committed generated-file state. During the
  pre-release prototype, configuration and report schema 1 continue evolving
  in place rather than creating version 2.
- Added ordered project-root `.pannonico` rules for Pannonico, opaque-copy,
  Vite, and exclusion ownership within configured source roots. Added
  default-on same-path JPEG and PNG optimization for Pannonico-owned copied
  assets, with byte-identical explicit copies, metadata-aware fallback, and a
  project-wide disable setting. Selected smaller files remove source metadata,
  including EXIF and GPS data, as a web privacy feature. JSON reports and MCP
  builds receive one source-free information diagnostic listing every removed
  metadata category. Human builds show the same explanation and bullets without
  the machine diagnostic header, alongside image before/after sizes. For a
  recognized gain-map JPEG, optimization removes the gain map and publishes
  only the base SDR image.
- Changed the edition migration contract: unconfigured Pro now uses base
  Markdown, and existing projects that relied on implicit Rich Markdown plugins
  must opt in at project or page scope. Explicit Free Rich Markdown requests
  fail with `CAPABILITY_UNSUPPORTED`. Stable paid commands and options now parse
  in every edition and deny unavailable requests with status `4`. The current
  schema-1 report carries capability denials through ordered
  `capability=<name>` and `reason=<edition|target|not-entitled>` diagnostic
  notes.
- Added `pannonico mcp [root]`, a fixed-root stdio MCP server with authoritative
  project/page inspection, validation, page rendering, production build, and
  installed-version manual resources. The bounded surface is shared by Free
  and Pro native/WASI products and contains no filesystem editing or AI logic.
  Full reports remain on validation and build; focused inspection responses
  return only diagnostic counts or page-related diagnostics. Stdio frames and
  pending work have fixed limits, session cancellation reaches active work,
  and invalid build-date environment diagnostics do not reflect their value.
- Started the Go implementation with dependency and cross-target evidence.
- Added the Free `build`, `scaffold`, `manual`, and `capabilities` commands,
  deterministic help/version output, process streams, and documented statuses.
- Added a zero-config starter scaffold and embedded topic manual.
- Added executable Free WASI builds with preopened project confinement, native
  output parity, dry-run reports, scaffold, manual, and source-epoch support.
- Added the authoritative full-site demo with approved Free output, Free
  native/WASI parity, dry-run report acceptance, and demo-resource exclusion
  checks.
- Added lower-case `.md` pages, optional headline sections, tables,
  linkification, typographer punctuation, live Go template actions, and literal
  actions in code.
- Added safe runtime `markdown` fragments and paired compile-time Markdown
  blocks for authored HTML pages, layouts, and partials. The signed
  `html-only` tag marks the pre-Markdown baseline in all five product and
  distribution repositories.
- Added optional Vite backend-manifest integration for hashed TypeScript, CSS,
  SCSS, Vue/plugin, imported-asset, and dynamic-import output. Templates retain
  control of tags, and HTML and Markdown use the same asset context.
- Added structured native Vite build commands, external and WASI manifest
  consumption, dry-run validation, and Pro Integrated development mode
  coordination with Vite HMR.
- Added `pannonico scaffold --vite`, which creates a locked TypeScript/SCSS
  starter and selects build-only Free native, build-and-watch Pro native, or
  process-free WASI configuration from compiled capabilities.
- Added live build progress for native and WASI commands. Pannonico now reports
  phase starts, sorted file rows with aligned decimal sizes,
  terminal-aware file colors, and separated status-marked generation or failure
  timing during build and watch.
- Simplified CSS inlining to use `pannonico-inline-css` as its only
  control. Removed the prototype `css.inline` configuration field; Free now
  removes recognized directives, preserves stylesheet behavior, and emits one
  non-fatal `CSS_INLINING_IGNORED` warning per build. Reserved `pannonico-*`
  attributes now share strict preflight diagnostics and a directive-free final
  output audit; the old `data-pannonico-inline-css` spelling is a rename error.

#### Pro changes

- Added configurable Rich Markdown plugins for deterministic heading anchors,
  named and inline footnotes, abbreviations, subscript, superscript, marks,
  insertions, and deletions in Pro native and Pro WASI. Base Markdown remains
  the default until project or page controls explicitly request the group or
  one feature. Free accepts the schema and rejects an explicit request with a
  capability diagnostic. Executed
  footnotes now form one group ordered by their references in the final
  assembled page and placed as the last element of `.pannonico.content`.
- Added opt-in generic CSS inlining in Pro native and Pro WASI. Explicitly
  directive-selected embedded, copied, and production Vite stylesheets can apply static
  declarations before HTML formatting and validation; unsupported behavior
  remains residual, linked asset URLs are rebased, and the directive alone selects
  the transform.
- Added compile-time native Pro composition with deterministic result
  restoration, optional readable HTML beautification or
  conservative HTML minification, a coalescing file watcher, a last-good
  development server, and successful-promotion-only live reload.
- Added mutually exclusive Pro-only `--beautify` and `--minify` output modes,
  with transformation before final validation, plus native `--jobs` and
  `watch --host/--port/--open`. Default Free binaries expose and link neither
  transformer. The later shared native-worker change made `--jobs` available
  in Free as well.
- Added target-filtered Pro WASI with both pure HTML transformations, explicit
  `--jobs 1` serial compatibility, and status-4 rejection for parallel jobs and
  native-only Integrated development mode.
- Added Pro Vite development startup, readiness polling, config refresh,
  frontend-change exclusion, child-failure propagation, and bounded cleanup.
- Added approved Pro full-demo output and exact serial/parallel rendering
  parity across the complete generated and pass-through tree.

#### Internal changes

- Added protocol-neutral inspection projections, the official Go MCP SDK
  v1.7.0 adapter, fresh-call performance benchmarks, real native command
  acceptance, and one focused WASI lifecycle smoke.
- Added the private repository bootstrap and Phase 0 engineering policy.
- Added strict project configuration, portable path-safety checks, stable
  diagnostics, JSON-compatible data values, owned domain models, and JSON
  report schema v1.
- Added deterministic source discovery, strict file classification, built-in
  ignores, symlink rejection, exact output mapping, and collision planning.
- Added strict page/layout frontmatter, JSON/YAML data loading, recursive data
  namespaces and merging, immutable content snapshots, and JSON copy plans.
- Added automatic Go template registration, partial dependency validation,
  immutable registry metadata, and per-page layout selection.
- Added immutable rendering contexts, strict template execution, contextual
  escaping, `has` and `get`, trusted page-to-layout insertion, and in-memory
  generated-page artifacts.
- Added exact page matching, reproducible UTC build-date formatting, and
  executable native Go template migration examples.
- Added BCP 47 language resolution, reciprocal translation groups, strict
  translation fallback, and CLDR cardinal plural helpers.
- Added scoped final-HTML validation, complete in-memory dry runs, deterministic
  schema-v1 build reports, and explicit report writing after failed builds.
- Added byte-exact pass-through copying, verified complete-tree staging,
  backup-first output promotion, rollback, and non-dry build reporting.
- Added typed synchronous build progress events and serialized staged-file
  notifications without changing parallel worker output.
- Added compile-time Free capability metadata, strict manifest-to-registration
  generation, native resource embedding, traversal-resistant scaffold writes,
  and CLI golden, subprocess, and binary-selection coverage.
- Added a build-tagged application runtime boundary, indexed concurrent page
  jobs with parallel validation, direct Free-to-Pro registration generation,
  confined development serving, response-only EventSource injection, and
  native watcher lifecycle coverage.
- Added a repository policy check for name-led Go documentation on every owned
  named function, method, and reusable test helper.
- Added separate native/WASI process adapters, target-filtered Pro registration,
  a fixed-root Node preview1 host, and executable product WASI acceptance.
- Added recursive edition inheritance and dependency resolution, conflict and
  target-exclusion checks, effective manifest hashes, and general target-aware
  registration generation.
- Added deterministic seven-target local release construction with executable
  inspection, archives, checksums, canonical metadata, SPDX SBOM, dependency
  notices, changelog extraction, exact-tree verification, reproducibility
  coverage, and native/WASI full-demo acceptance.
- Added the pure-Go Goldmark Markdown compiler, authored-source diagnostic
  mapping, request-local fragment IDs, dependency policy evidence, and native,
  Pro, race, and WASI coverage.
- Added stable Vite manifest adapters, immutable asset snapshots, strict Vite
  config/path diagnostics, target-filtered Free WASI registration, and a locked
  latest-Vite compatibility fixture.
- Replaced checked-in version-specific release-note files with GitHub-generated
  release descriptions while retaining the package changelog as the maintained
  migration history.

### LSP

#### Public changes

- Added conservative call-site context inference for standalone partials in
  the language server. Completion, hover, unique-source definitions, and
  definite saved direct-path diagnostics now work through selected page and
  layout calls that explicitly forward unchanged dot, including transitive and
  compatible multi-page calls. Replaced-dot, changed-dot, unreachable, and
  mixed call sites remain suppressed.
- Started the Go implementation with dependency and cross-target evidence.

#### Internal changes

- Added the private repository bootstrap and Phase 0 engineering policy.
- Added strict project configuration, portable path-safety checks, stable
  diagnostics, JSON-compatible data values, owned domain models, and JSON
  report schema v1.
- Added deterministic source discovery, strict file classification, built-in
  ignores, symlink rejection, exact output mapping, and collision planning.
- Added strict page/layout frontmatter, JSON/YAML data loading, recursive data
  namespaces and merging, immutable content snapshots, and JSON copy plans.
- Added automatic Go template registration, partial dependency validation,
  immutable registry metadata, and per-page layout selection.
- Added a repository policy check for name-led Go documentation on every owned
  named function, method, and reusable test helper.
- Replaced checked-in version-specific release-note files with GitHub-generated
  release descriptions while retaining the package changelog as the maintained
  migration history.

## 0.3.3

### CLI

- Aligned the CLI's public version with the independently released LSP and VS
  Code tracks. Native and WASI build and render behavior remained unchanged
  from CLI 0.3.2.
- Published the partial call-site context documentation used by the editor
  integrations in the embedded and public manual.

### LSP

- Added conservative call-site context inference for standalone partials.
  Completion, hover, unique-source definitions, and definite saved-file
  diagnostics now work through selected page and layout calls that explicitly
  forward the unchanged root context, including transitive and compatible
  multi-page calls.
- Continued suppressing partial intelligence for replaced or unprovable root
  contexts, mixed call shapes, and partials unreachable from rendered pages.
  The LSP protocol and IDE contract remained unchanged.
- Advanced directly from 0.2.0 to 0.3.3 to align the public version with the
  independently released CLI and VS Code tracks.

## 0.3.2

### CLI

- Updated the optional top-level and manual-help release footer to its current
  two-line message supporting the Serbian struggle against dictatorship and
  `https://blokade.org`.
- Made one source-controlled text file the native and WASI footer source. An
  empty or whitespace-only file omits the footer without changing the
  documentation link or leaving an extra separator.
- Replaced incompatible child-process event typings in installed npm package
  acceptance while preserving output bounds, status reporting, native
  execution, and bundled-WASI fallback checks.

## 0.3.1

### CLI

- Moved scaffolded `package.json`, `package-lock.json`, `tsconfig.json`, and
  `vite.config.js` beside `pannonico.yaml`, while keeping frontend sources and
  generated Vite assets below `frontend/`. Successful Vite scaffolding now
  prints the directory and `npm install` guidance.
- Replaced machine codes in human CLI diagnostic headers with plain-English
  labels while retaining stable codes in JSON reports, MCP results, sorting,
  and exit behavior.
- Added the optional release footer after top-level and manual-help
  documentation links. The 0.3.1 message supported Serbian students in their
  struggle against the dictatorial regime and linked to `https://blokade.org`.

## 0.3.0

### CLI

- Made bounded native page rendering and `--jobs` shared Free and Pro
  behavior. Both editions default to the smaller of sixteen workers and the
  host's logical CPU count. Native staged-file publication uses the same
  bounded policy in both editions, while both WASI products remain serial.
- Reduced native build allocation and filesystem work in quiet progress,
  rendering ownership, source validation, directive-free HTML processing, and
  staged-output verification without changing output bytes or atomic
  publication.

## 0.2.0

### CLI

- Separated CLI, LSP, and VS Code release lifecycles and kept standalone
  binaries as GitHub Release assets rather than Git or Git LFS content.
- Added `pannonico manual --eject [root]` and
  `pannonico scaffold --with-docs [root]` to write the complete
  version-matched manual below a site's `documentation/` directory with
  working relative links.
- Replaced raw terminal Markdown topics with command help and documentation
  ejection guidance while retaining MCP documentation resources.
- Adopted the documented pre-1.0 compatibility and migration policy.

### LSP

- Published the edition-neutral language server as an immutable WASI module
  with a closed verification manifest. Pannonico for VS Code 0.2.0 selected
  that exact release and verified its size and SHA-256 digest before use.

## 0.1.3

### CLI

- Published the Pannonico Free npm launcher and six target-specific native npm
  packages with a verified WASI Preview 1 fallback.
- Refreshed the public CLI and VS Code installation documentation. The npm
  package links to the complete CLI guide and explains how to open the
  version-matched embedded manual with `pannonico manual`.
- Corrected public documentation so it no longer links to an absent standalone
  GitHub Release.

## 0.1.2

### CLI

- Published Pannonico Free command-line executables for macOS, Linux, and
  Windows on x64 and ARM64, plus the portable WASI module.
- Added the initial public npm package set for those native targets, with native
  selection and a verified WASI Preview 1 fallback.

## 0.1.1

### LSP

- Published the edition-neutral language server as an immutable WASI module
  with its closed verification manifest for integrity-checked editor use.

## 0.1.0

### LSP

- First public release of the edition-neutral Pannonico language server as an
  immutable WASI module with a closed verification manifest. Supported editor
  integrations download and verify it rather than install it as a standalone
  command-line application.
