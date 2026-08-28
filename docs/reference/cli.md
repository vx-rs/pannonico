# Command-line interface

The CLI contains one compile-time edition. Project
configuration and environment variables cannot select another edition or add a
capability. Only an eligible native ad hoc build may ask for an output path.

## Commands

```text
pannonico build [flags] [root | page]
pannonico scaffold [flags] [root]
pannonico manual [--eject [root]]
pannonico mcp [root]
pannonico capabilities
pannonico --help
pannonico --version
```

`-h` aliases `--help`; `-v` and the `version` command alias `--version`.
Build flags may appear before or after its optional root or page. The root
defaults to the current directory. `pannonico help <command>` prints
command-specific usage. Unknown syntax exits `2`; the known Pro-only `watch`
command exits `4` in the Free binary.

Top-level and manual help end with the documentation-site link. A release may
compile one optional note after that link, separated by a blank line. The note
is blue on a color-enabled stdout terminal, plain when color is suppressed or
output is redirected, and absent when the release configures an empty value.

A native Pro binary also provides `pannonico watch [flags] [root]`.

## MCP

`pannonico mcp [root]` serves the built-in MCP tools and installed manual over
newline-delimited stdio. The optional root is fixed for the session; omission
uses the native invocation working directory, with no parent search. The
command accepts no flags other than `--help`.

Stdout is reserved exclusively for protocol JSON. Startup and configured child
diagnostics use stderr. Closing stdin is a clean shutdown. The server exposes
`inspect_project`, `validate_project`, `inspect_page`, `render_page`, and the
mutating `build`, plus `pannonico://docs` resources. See
[`mcp.md`](../mcp/README.md) for schemas, freshness, result semantics, trust boundaries,
and generic client configuration. `inspect_project` returns the same ordered
available capability names shown by `pannonico capabilities`.

## Build flags

| Flag                         | Behavior                                                                                                     |
|------------------------------|--------------------------------------------------------------------------------------------------------------|
| `--config PATH`              | Select a config file inside the project root.                                                                |
| `--pages PATH`               | Select one page file or a pages directory.                                                                   |
| `--layouts PATH`             | Override the layouts directory.                                                                              |
| `--partials PATH`            | Override the partials directory.                                                                             |
| `--data PATH`                | Replace project data with one invocation-local directory.                                                    |
| `--out PATH`                 | Override the output directory.                                                                               |
| `--default-layout NAME`      | Override the default layout.                                                                                 |
| `--default-language CODE`    | Override the default language.                                                                               |
| `--html-validation MODE`     | Select `off`, `warn`, or `error`.                                                                            |
| `--max-output-workers COUNT` | Lower the staged-file publication worker limit.                                                              |
| `--dry-run`                  | Run in-memory phases without changing site output.                                                           |
| `--report-json PATH`         | Write a schema-v1 report after success or failure.                                                           |
| `--quiet`                    | Suppress progress and build-result output.                                                                   |
| `--verbose`                  | Add resolved paths, edition metadata, defaults, validation/image policy, and sitemap plan/publication state. |
| `--no-color`                 | Disable all Pannonico ANSI presentation color.                                                               |

Native publication starts from thirty-two staged-file workers per available Go
execution thread and is bounded by artifact count. Free and Pro use the same
policy without an edition-specific ceiling. A positive
`--max-output-workers` value can lower the applicable limit in either edition;
it cannot raise the thread-derived count. The flag is separate from `--jobs`,
which controls page rendering in both native editions. WASI and additive ad
hoc publication remain serial.

Both native editions accept `--jobs COUNT`, from `1` through the host's logical
CPU count. The default worker count is the smaller of sixteen and the logical CPU
count; one page or one worker stays on the serial path. Native Pro additionally
accepts repeatable `--data-url URL` flags with exactly one HTTPS JSON/YAML
source per occurrence, plus `--beautify` and `--minify`. Beautification emits
readable two-space-indented HTML; minification emits conservative compact HTML.
The output flags are mutually exclusive. Free recognizes these stable Pro
options, then returns `CAPABILITY_UNSUPPORTED` and status `4` before feature
side effects.

Sitemap generation has no CLI flag. Configure `site.url` and optional
`sitemap.enabled` in version-1 project configuration. A verbose build reports
the sitemap as planned, generated, disabled, missing `site.url`, or blocked by
a failed build; eligible states also show the normalized base URL, included and
excluded route counts, and `sitemap.xml` output. See
[`sitemap.md`](../build-and-output/sitemap.md).

Pro WASI retains both HTML output flags and accepts `--jobs 1` for explicit
serial rendering. A value greater than one requests unavailable parallel
rendering and returns `CAPABILITY_UNSUPPORTED` with status `4` before project
discovery. `watch` and `help watch` return status `4` and name the native-target
requirement.

Generic CSS inlining has no CLI or project setting. Rendered templates select
individual sources with `pannonico-inline-css`. Pro performs the transform;
Free keeps the stylesheet behavior, removes the directive, prints one non-fatal
warning, and retains exit status `0` when no error exists. See
[`directives.md`](../authoring/directives.md) for the common syntax and
[`css-inlining.md`](../vite/css-inlining.md) for CSS behavior.

Raw template output remains the default. A selected Pro transformation runs
after template rendering and before final HTML validation, including during a
dry run or every watch rebuild. Beautification uses fixed two-space indentation,
LF line endings, no wrapping, and no final newline. It retains authored tag,
attribute, entity, comment, and doctype bytes and preserves whitespace-sensitive
and embedded foreign content. Neither transform repairs malformed HTML.

`--quiet` and `--verbose` are mutually exclusive. A dry run may still write an
explicit report. The report parent must already exist, and the target must be a
regular non-symlink file or a new file.

A native TTY build of one selected page or the shallow project-root fallback
asks `Output directory [dist]:` when no output was authored. Press Enter for
`dist`. CI, redirected streams, WASI, structured projects, `--quiet`, and
`--dry-run` never prompt. The selected value then follows normal output
validation. See [`minimal-builds-and-data.md`](../build-and-output/minimal-builds-and-data.md) for
the narrow no-clobber `.` behavior.

## Streams and color

Build progress is live on standard output. The first line identifies
`pannonico` and its version, then names the production, dry, or development
build. Each phase line is written when that phase starts. A managed Vite
command writes its own output between Pannonico's frontend phase lines.
That child process owns its own color and formatting policy.

During publication, Pannonico prints one row after each file has
been written, synced, and closed in the private staging tree. It does not print
standalone directory rows. Each row uses the final output path and its
decimal size in `B`, `KB`, or `MB`. When image optimization produces a smaller
file, that image's row shows `source size → output size`; images that retain
their original bytes show one size like every other artifact. Paths are padded
to the longest planned final artifact so sizes form one live column without
delaying staged-write notifications. Artifact lines remain sorted even when
either native edition renders pages in parallel. Final promotion is still
atomic; a later
verification or promotion failure may follow staged-file lines with a failed
result and diagnostic.

Selected optimized images remove source metadata as a privacy feature. This
adds one explanatory sentence and a deduplicated category list after a blank
separator and before the final build result. Human output omits the
`INFO Image metadata removed` human header, writes this build information to
standard output, and contains no image paths. JSON reports and MCP `build`
results retain the full source-free information diagnostic. It does not
increment `warningCount`.

Artifact paths use the configured output identity relative to the project root.
They are not rebased against the shell working directory, so invoking Pannonico
from a parent directory does not introduce `../` components into these rows.
Configuration rejects parent traversal in output paths.

After diagnostics and one blank separator, the completion line uses `✓` for
success or `✗` for failure and reports the same measured interval stored as
`durationMs` in the schema-v1 report. It is the final non-empty build line and
is followed by another blank line. A successful production or watch build says
`generated in`; a successful dry run retains `dry build completed in`; and a
failure says `build failed in`. Success is green and failure is red. Detailed
warnings and errors appear on standard error before this final result and
identify failed operations. A report write failure can make the result red
after the site itself was published; its diagnostic distinguishes that case.

Informational commands also use standard output. Quiet builds suppress the
identity, phases, artifacts, and completion line but still print warnings and
errors. Output has no timestamps, progress bars, cursor control, or animation.

Diagnostic color is enabled only when standard error is a character device.
Build color is enabled only when standard output is a character device. Both
are disabled by `--no-color`, a non-empty `NO_COLOR` or `CI`, or `TERM=dumb`.
When build color is enabled, the product identity is cyan, the active build and
successful result are green, and failure is red. Artifact rows follow
Rolldown's presentation groups: JavaScript filenames are cyan, CSS is magenta,
and every other asset is green. Pannonico keeps generated HTML as its dark-blue
document-specific exception. Only the filename receives that color; directory
components use the terminal's dim style and sizes use bold plus dim. Their
exact gray shade therefore follows the terminal theme. Redirected Pannonico
output keeps the same text without ANSI escapes.

## Exit status

| Status | Meaning                                                            |
|--------|--------------------------------------------------------------------|
| `0`    | Success, including validation warnings.                            |
| `1`    | Build, validation, output, scaffold, or manual ejection failure.   |
| `2`    | Invalid arguments, environment input, or project configuration.    |
| `3`    | Unexpected internal failure contained at the CLI boundary.         |
| `4`    | Known command or capability unavailable in this edition or target. |

## Scaffold

The default scaffold writes one zero-config site with a page, default layout,
nested partials, data namespaces, frontmatter, and representative helpers. It
does not write `pannonico.yaml`.

`--vite` adds a locked npm frontend with Vite, TypeScript, SCSS, ordinary copied
CSS, a Vite tag partial, and `pannonico.yaml`. The running binary selects the
profile from its compiled capabilities:

| Profile     | Configuration                                                                                |
|-------------|----------------------------------------------------------------------------------------------|
| Free native | Runs the Vite production build before `pannonico build`; does not configure Pannonico watch. |
| Pro native  | Runs production builds and configures the coordinated Vite dev server for `pannonico watch`. |
| WASI        | Omits process commands; the host builds Vite before Pannonico consumes the manifest.         |

Both Free and Pro WASI use the WASI profile. Scaffolding writes files only. It
does not install npm dependencies or execute Vite. Follow the generated
`README.md` to run `npm install` from the project root and the profile-specific
first build. After successful Vite scaffolding, the CLI identifies
`frontend/` as the asset directory and prints this installation command.

`--min` creates only `pannonico.yaml` containing `version: 1`. `--empty`
creates only the four conventional source directories. `--min`, `--empty`, and
`--vite` are mutually exclusive. `--with-docs` is independent of those modes
and writes the same version-matched manual as `manual --eject` below
`<root>/documentation/`. A normal installation preflights every known scaffold
and manual file before writing and refuses existing targets. `--force`
replaces only known regular scaffold and manual files. It never removes
unrelated files. Symlinked roots, directory components, and targets are
rejected; writes are anchored inside the opened project root.

## Manual and capabilities

`pannonico manual`, `pannonico manual --help`, and `pannonico help manual`
print the same command help. `pannonico manual --eject [root]` writes the
complete embedded manual below `<root>/documentation/`, using `.` when root is
omitted. It preserves every canonical relative path and Markdown byte so links
work from the ejected `README.md`. Existing known files are conflicts; this
command has no force mode. Raw `manual --list` and `manual <topic>` output was
removed because terminal Markdown cannot provide working links. Programmatic
MCP topic resources remain available.

The `manual` and `scaffold` capability records are version 2. Version 2 adds
local manual ejection through the two command surfaces.

`pannonico capabilities` prints the compiled edition and canonical ordered capability
descriptor versions. It describes the binary; it does not inspect project
configuration. MCP `inspect_project` returns the same names in the same order.
`pannonico --version` remains limited to product version, edition, and target;
schema-v1 reports are not full capability
discovery surfaces.

## Native Pro Integrated development mode

The `watch` command provides Integrated development mode: automatic Pannonico
rebuilds, a preview server, live browser reload, and a managed configured Vite
development server. `watch` accepts the normal project build flags except `--dry-run`, `--data`,
and `--data-url`, plus `--host`
(default `127.0.0.1`), `--port` (default `3000`), and `--open`. It builds once,
then polls and coalesces project changes. Rebuilds never overlap. A source
change observed while a build runs causes another serialized build.

The server begins after the first successful promotion. A later failed build
does not replace the output, change the served root, or trigger reload. The
live-reload client is inserted only into served HTML responses; generated files
are unchanged. `Ctrl-C` cancels watching and waits for server shutdown.

With Vite enabled, native builds may run the configured structured
`buildCommand` before manifest loading. Dry run never executes it. A WASI
production build cannot execute it, emits `VITE_COMMAND_SKIPPED_TARGET` once,
and uses the existing valid manifest; missing or stale manifests still fail. Pro
watch starts or waits for the configured Vite server, watches only Pannonico
inputs, leaves asset HMR to Vite, refreshes changed Vite configuration, and
waits for an owned child during shutdown. See
[`vite-integration.md`](../vite/integration.md).
Verbose production output includes the selected Pannonico manifest format and
its explicit, marker, or structural selection method.

Binding a non-loopback host is an explicit trust decision: the development
server has no authentication or TLS and is intended for local preview.

## WASI process behavior

The WASI binary requires a preview1 host to preopen the selected project. A
compatible launcher maps one real host directory to `/project`; product
arguments inside the guest use that path. Commands receive inherited standard
streams, exact exit-status forwarding, and only approved environment values.
The current approved environment value is `SOURCE_DATE_EPOCH`.

WASI cannot infer or access the host current working directory. Paths outside
the project preopen are unavailable, and Pannonico's normal relative-path and
symlink rules still apply inside it. A launcher gives `manual --eject` one
writable selected root; bare/help manual forms need no filesystem. Scaffold
`--with-docs` reuses its selected scaffold root. Free WASI supports build, dry
run, JSON reports, scaffold, manual, MCP stdio, and capability metadata. Pro WASI adds pure HTML
beautification and minification but excludes parallel rendering, watch, the
development server, live reload, and Vite process execution at compile time.
Both WASI editions can consume an existing Vite manifest and output through
`vite-integration`. Read the [WASI runtime reference](wasi.md) for the complete
host, capability, data, Vite, and MCP boundary.
