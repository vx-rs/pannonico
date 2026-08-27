# Frontmatter and data

Pannonico loads page and layout frontmatter plus the `.data`, `.page`,
`.local`, and `.layout` namespaces into an immutable in-memory content
snapshot. This step does not parse Go templates or write output.

## Frontmatter delimiters

Page and layout frontmatter uses YAML between exact delimiter lines:

```html
---
title: About
---
<h1>{{.page.title}}</h1>
```

Rules:

- An optional UTF-8 BOM is consumed before delimiter detection.
- The opening `---` line must be the first line after the optional BOM.
- The closing line must contain exactly `---`.
- LF and CRLF line endings are accepted, including mixed input.
- The template body begins after the closing delimiter line ending and its
  remaining bytes are preserved.
- A closing delimiter at end of file produces an empty body.
- An opening delimiter without a closing delimiter is an error.
- A file without an opening delimiter has no frontmatter. Its body is the
  complete input after the optional BOM.
- An empty frontmatter block is an empty object.
- Non-empty frontmatter must be one YAML object.

Partials do not support frontmatter in V1.

## Page controls

Page frontmatter reserves these controls:

```text
layout
lang
translationKey
headlineSections
richMarkdown
pannonico.sitemap.exclude
```

The first three controls must be non-empty strings without leading or trailing
whitespace. `headlineSections` must be a boolean and enables structural wrappers
for Markdown headings when true. `richMarkdown` must be an object containing
only Boolean `enabled`, `anchor`, `footnote`, `abbr`, `container`,
`codeHighlight`, `sub`, `sup`, `mark`, `ins`, and `del` values. It applies
after the project Rich Markdown selection. A page explicitly requests Rich
Markdown when its object contains `enabled: true` or any individual feature set
to `true`, including a feature enabled under `enabled: false`. Absence, an empty
object, inherited project enablement, and page values that are all `false` do
not create a page request. In Free, each requesting page receives one
`CAPABILITY_UNSUPPORTED` diagnostic and status `4`; several true fields in the
same page object still produce one diagnostic for that page source.
`pannonico` is a reserved page-only control object. Its current shape is
`pannonico.sitemap.exclude`, where `exclude` must be Boolean. `true` removes the
page only from `sitemap.xml`; rendering, validation, and publication continue.
Unknown fields or shapes in this reserved object report
`FRONTMATTER_INVALID_CONTROL`. The parser removes the complete reserved object
from `.page` content. Layout frontmatter named `pannonico` remains ordinary
`.layout` data.

The parser removes all controls from `.page` content. `layout: none` remains an
exact control value for layout selection.

Sidecar fields with these names are ordinary `.page` content. They never
change the controls extracted from page frontmatter. This allows published
JSON to contain a field such as `lang` or `pannonico` without changing build
language or sitemap membership.

Pannonico validates resolved page, selected-layout, and configured language
values as BCP 47 tags. `translationKey` requires a resolved language.

Layout frontmatter remains intact under `.layout`. Fields such as `lang`,
`dir`, and `bodyClass` are not merged into `.page`.

## Data parser boundary

JSON and YAML become the JSON-compatible value model documented in the
architecture:

- null;
- booleans;
- strings;
- `json.Number` values;
- arrays;
- string-keyed objects.

JSON numbers retain their source representation through `json.Number`.
Duplicate JSON object keys fail at any depth. Empty, malformed, trailing, and
multi-value JSON input fails.

YAML uses the approved vendored parser with unique keys, one document, a
maximum depth of 100, and a maximum of 100 alias expansions. Finite YAML
integers and floating-point values become `json.Number`. Non-string object keys,
timestamps, binary values, non-finite numbers, and other YAML-native values
that have no JSON-compatible representation fail.

Global and local data files may contain any JSON-compatible root value. A
matching page sidecar must contain an object because it merges into `.page`.

`--data PATH` replaces the configured global data directory for one invocation.
Native Pro may also add remote global documents through repeated
`--data-url URL` flags or `data.urls`. Both sources use this same parser and
identifier model. Remote filenames form top-level identifiers; local directory
paths may form nested identifiers. See
[`minimal-builds-and-data.md`](../build-and-output/minimal-builds-and-data.md) for path, edition,
network, and resource-limit rules.

Data never crosses a marked project boundary. A parent does not load global,
page-local, sidecar, frontmatter, or invocation-local data below a child root,
and a child does not inherit the parent's `.data`. Remote data belongs only to
the configuration that declares its URL. Run the parent and child separately
when both outputs are needed.

## Identifier rules

Global path components and local filename stems become template identifiers:

1. Remove the data-file extension.
2. Replace ASCII hyphens and spaces with `_`.
3. Require `[A-Za-z_][A-Za-z0-9_]*` for every component.
4. Compare the resulting identifier path with Unicode lower-case keys.

Examples:

```text
data/site.yaml                 -> .data.site
data/company/team.json         -> .data.company.team
pages/blog/site-data.yaml      -> .local.site_data
https://example.test/nav.json  -> .data.nav (native Pro)
```

Global files that resolve to the same identifier collide. A global file also
collides with a nested file when its identifier would need to be both a value
and a directory:

```text
data/company.yaml
data/company/team.yaml
```

Case-only spellings of one global directory identifier also collide even when
their leaf names differ. This prevents `.data.Company` and `.data.company`
from varying by host filesystem.

Matching page sidecars are selected before identifier rewriting. Matching
compares the complete extensionless path using slash-separated Unicode
lower-case keys. Therefore `2026-report.yaml` may be the sidecar for
`2026-report.html`, while `article-page.yaml` does not attach to
`article_page.html`.

## Namespace precedence

For `pages/blog/article.html` or `pages/blog/article.md`, matching sidecars are
`pages/blog/article.yaml`, `pages/blog/article.yml`, and
`pages/blog/article.json`.

`.page` merges authorities in this order:

1. one matching YAML or YML sidecar;
2. non-reserved page frontmatter;
3. one matching JSON sidecar.

Two matching YAML spellings or two matching JSON spellings collide.

`.local` contains other supported data files in the page's exact directory.
It does not inherit from parent directories. YAML loads before JSON only when
the files have the same authored stem, ignoring case:

```text
authors.yaml + authors.json       merge as .local.authors
site-data.yaml + site_data.json   collide
authors.yaml + authors.yml        collide
```

A sidecar for one page is local data for another page in the same directory.

## Recursive merge rules

| Earlier value                 | Later value | Result                        |
|-------------------------------|-------------|-------------------------------|
| object                        | object      | merge recursively             |
| array                         | array       | replace with the later array  |
| scalar                        | scalar      | replace with the later scalar |
| any category                  | null        | replace with null             |
| different non-null categories | any         | fail at the exact value path  |

Null is a scalar when it is the earlier value. A prior null followed by an
object or array is therefore an incompatible category change. Each merge is
atomic and does not mutate either input. When one authority fails, none of
that authority's fields are applied.

## Source revalidation and JSON copying

The content loader revalidates every page, layout, and data source at its read
boundary. It rejects symlinks and non-regular files, checks the opened file,
and confirms that the path still identifies the opened file after reading.
This narrows discovery-to-read races. It cannot prevent an in-place write to
an already opened regular file.

Every page JSON candidate retains its exact source, output identity, and
immutable authored bytes in the content snapshot. A JSON parse error still
leaves the copy plan visible for a complete preflight report, but any error
prevents output mutation. A successful build rereads the source safely and
requires it to match the snapshot before copying, so published JSON is the
same document that content preflight consumed.
