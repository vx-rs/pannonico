# Rendering context and escaping

Template execution produces immutable in-memory HTML artifacts. The core API
does not mutate output; the complete build pipeline may then apply an injected
Pro HTML transform, validate the resulting bytes, and stage them for promotion.

## Context shape

Every template receives exactly these top-level namespaces:

```text
.data
.page
.local
.layout
.pannonico
.nav
```

The context constructor validates and recursively clones the five ordinary
JSON-compatible namespaces. A nil ordinary namespace becomes an empty object.
`.nav` is a separately validated, navigation-owned read-only graph whose
canonical parent and child relationships may be cyclic. Mutating an ordinary
input or an inspected context copy cannot change later rendering.

`.data`, `.page`, and `.local` come from the immutable content snapshot.
`.layout` contains only the selected layout's frontmatter. A page with exact
`layout: none` receives an empty `.layout` object.

`.nav` contains the canonical site hierarchy, current page, and containing
directory. Its `c`/`p` collections, explicit indexes, parents, ancestors,
referenced page data, and identifier encoding are documented in
[`navigation.md`](navigation.md).

Rendering exposes these `.pannonico` fields:

| Field          | Value                                                                                    |
|----------------|------------------------------------------------------------------------------------------|
| `sourcePath`   | Project-relative page source path.                                                       |
| `outputPath`   | Slash-separated generated output path.                                                   |
| `pagePath`     | Page path without the `.html` extension.                                                 |
| `pageName`     | Final page-path component.                                                               |
| `layout`       | Exact selected layout name, or null when disabled.                                       |
| `buildDate`    | Build-wide UTC `YYYY-MM-DD` value captured at build start, honoring `SOURCE_DATE_EPOCH`. |
| `version`      | Pannonico version supplied by metadata.                                                  |
| `edition`      | Compiled edition supplied by metadata.                                                   |
| `capabilities` | Ordered capability-name array supplied by metadata.                                      |
| `language`     | Resolved language object, or null when unset.                                            |
| `translations` | Ordered translation-link objects excluding the current page.                             |
| `vite`         | Absent when disabled; otherwise the immutable production or development asset object.    |
| `content`      | Absent during the page pass; trusted rendered page HTML during the layout pass.          |

The build target is not a template field. Callers cannot supply `content` to
the context constructor.

When enabled, `.pannonico.vite` contains `mode`, nullable `server` and `client`,
`entries`, and `resources`. Each configured entry alias contains `file`, `css`,
`modulePreload`, and `assets`. Each resource alias contains only `file`.
Every value is ordinary untrusted URL data; templates author the tags. The
exact shape and examples are in
[`vite-integration.md`](../vite/integration.md).

## Strict values and optional access

Ordinary map access uses Go template `missingkey=error` behavior:

```html
{{.page.title}}
```

If `title` is absent, rendering stops with a source-positioned diagnostic.

For saved local data, the language server also checks certain direct paths in
every saved page and layout. If this source exists:

```yaml
company:
  team:
    lead: Ada
```

then removing `lead` marks every saved source containing
`{{.data.company.team.lead}}` with an Error at `lead`, including sources that
are closed in the editor. Restoring the key and saving the data source clears
those workspace diagnostics. Configured remote data is not fetched by the
language server, so uncertain remote descendants remain unmarked.

Use `has` before optional access:

```html
{{if has .page "subtitle"}}
  <p>{{get .page "subtitle"}}</p>
{{end}}
```

`has` and `get` accept object roots and non-empty dot-separated object paths.
They use exact key spelling. A present null value exists. A missing `has` path
returns false, while a missing `get` path is an execution error.

Traversal through null, a scalar, or an array is an error. Numeric array
indexes are not supported. Keys containing a literal dot cannot be addressed
through these helpers in V1.

Partials use native Go template dot semantics. This call replaces the
partial's dot with the nested object:

```html
{{template "components/card" .page.featuredItem}}
```

The partial reads `{{.title}}`; Pannonico does not inject a hidden root
context.

## Two-pass escaping boundary

Rendering performs these steps in memory:

1. Create the complete six-root base context without `.pannonico.content`.
2. Execute the page with `html/template` and strict missing keys.
3. Clone the base context.
4. Convert only the successfully rendered page bytes to `template.HTML` and
   store them as `.pannonico.content` in the clone.
5. Execute the selected layout with that clone, or return the escaped page
   bytes directly when layout rendering is disabled.

Strings from every data namespace and normal `.pannonico` fields remain
untrusted and contextually escaped. `get` returns ordinary untrusted values;
using it to retrieve `.pannonico.content` converts the trusted value back to
an ordinary escaped string.
There is no `safeHTML`, `raw`, or caller-controlled trusted-content helper.

## Execution diagnostics and artifacts

Execution assembles a fresh template set from copied parse trees for every
page and layout pass. Partials are attached under their automatic names. This
keeps stored registry state immutable and avoids sharing executed template
state between pages. The page or layout root uses a private name that cannot be
derived from a filesystem path, so a legal partial name cannot replace it.

Missing keys, helper errors, and contextual template execution errors use
`TEMPLATE_EXECUTION_FAILED`. A failure inside a partial is attributed to the
partial source and includes the page as a related source. Invalid or incomplete
snapshot context uses `TEMPLATE_CONTEXT_INVALID`.

`pageIs`, `date`, `has`, and `get` execute as documented in
[`core-template-helpers.md`](core-template-helpers.md). `t` and `plural`
execute with copied request-local language state as documented in
[`localization.md`](localization.md). Parse-only helper placeholders never
execute.

The build coordinator restores pages in output-path order and returns copied
source identity, output identity, and HTML bytes. It may retain successful
artifacts while reporting failures from other pages, but any error prevents a
non-dry build from entering the output-staging phase.

Free executes page jobs serially. Native Pro may schedule rendering,
transformation, and validation concurrently into preassigned result slots.
Discovery, shared preflight snapshots, diagnostic reduction, and output
promotion remain serial, so the selected worker count does not alter output
bytes or diagnostic order.
