# Migration from Handlebars

Pannonico Go keeps the site model but replaces Handlebars expressions with Go
`html/template`. Migrate one source role at a time, then build with strict
missing-key diagnostics enabled by default.

## Layouts and partials

Replace the legacy layout body insertion with the trusted rendered page value:

```html
<!-- before -->
{{{body}}}

<!-- after -->
{{.pannonico.content}}
```

Partial calls use their extensionless path and an explicit dot:

```html
{{template "shell/header" .}}
{{template "components/card" .page.card}}
```

Pannonico assigns template names from paths. Authored `define` and `block`
actions are unsupported.

## Conditions, lists, and page matching

Use native Go actions and the built-in helpers:

```html
{{if eq .page.kind "guide"}}Guide{{end}}
{{if pageIs .pannonico "index" "guides/start"}}Current{{end}}
{{if not (pageIs .pannonico "archive")}}Visible{{end}}
{{range $index, $item := .page.items}}{{if $index}}, {{end}}{{$item}}{{end}}
{{range 3}}<span>Repeated</span>{{end}}
```

Use `has` before optional access and `get` for a checked dynamic path. Direct
missing map keys stop template execution instead of becoming empty strings.
Numbers loaded from JSON, YAML, or frontmatter are `json.Number` values. Go's
native comparison helpers require compatible types, so a structured number
cannot be compared directly with an integer template literal. Compare it with
another structured number, as in `{{if eq .page.count
.page.expectedCount}}`, or model the condition with a string or boolean field.

## Data, dates, and localization

Global, page, directory-local, layout, generated, and site-navigation values
are available as `.data`, `.page`, `.local`, `.layout`, `.pannonico`, and
`.nav`. Sidecar precedence and reserved frontmatter controls are documented in
[`frontmatter-and-data.md`](../authoring/frontmatter-and-data.md).
The `c`/`p` hierarchy, explicit indexes, and encoded authored names are
documented in [`navigation.md`](../authoring/navigation.md).

```html
{{date "YYYY-MM-DD"}}
{{t .data.labels.heading}}
{{plural .page.count .data.labels.items}}
```

Both localization helpers receive language-keyed dictionaries, not dotted key
names. The dictionaries and exact fallback rules are documented in
[`localization.md`](../authoring/localization.md).

Translation switchers iterate `.pannonico.translations`; do not reproduce the
legacy helper's raw markup return:

```html
{{range .pannonico.translations}}
  <a href="{{.url}}" lang="{{.code}}">{{.label}}</a>
{{end}}
```

JSON page sidecars remain browser-readable copied files. YAML sidecars are
consumed as data and are not copied.

## Markdown pages

Keep a source as lower-case `.md` when it should render Markdown. For example,
`pages/guides/start.md` still emits `dist/guides/start.html`. Frontmatter and
sidecars work as they do for HTML pages.

Replace Handlebars expressions with Go actions directly in authored Markdown:

```markdown
---
title: Getting started
headlineSections: true
---
# {{.page.title}}

Welcome to **{{get .data "site.name"}}**.[^source]

`{{.page.title}}` is literal because it is inside Markdown code.

[^source]: Footnotes retain stable Pannonico links and classes.
```

Tables, linkification, typographer punctuation, raw authored HTML, and
headline wrappers belong to the shared base dialect. In Pro, heading IDs,
footnotes, fenced containers, and deletion markup come from the configurable
rich-Markdown plugins. Their exact contracts are in
[`markdown.md`](../authoring/markdown.md). Live actions do not contribute to a Pro heading
ID; inline code does.

## Replacing legacy Markdown blocks

Choose based on where the text originates:

- Prefer a `.md` page for a document whose primary source is Markdown.
- Use `{{markdown VALUE}}` for a runtime string from frontmatter or structured
  data. It disables raw HTML and dangerous URL schemes.
- Use paired compile-time directives for trusted authored Markdown embedded in
  an `.html` page, layout, or partial.

```html
<aside>
{{/* pannonico:markdown */}}
## {{.page.releaseTitle}}

An authored **Markdown** block with a footnote.[^release]

[^release]: Compiled before Go template execution.
{{/* /pannonico:markdown */}}
</aside>
```

The runtime helper does not parse template syntax contained in data, and its
result is valid only in element content. Move trusted raw HTML to a source page
or compile-time block instead of putting it in runtime Markdown.

## Removed extension points

V1 does not load custom Handlebars helpers, user-supplied Markdown plugins,
task lists, definition lists, Markdown layouts, or Markdown partial files.
Pro Rich Markdown highlights recognized fenced-code languages with compact CSS
classes but provides no built-in theme or custom lexer loader. Replace small
presentation helpers with Go template actions. Configure
JavaScript, TypeScript, Sass, Vue, React, and other frontend plugins in the site
project's Vite setup, then consume their manifest through the optional
[`Vite integration`](../vite/integration.md).

The signed `html-only` tag in each product and distribution repository marks
the final baseline before Markdown support was introduced.

## Migration verification

Build the converted site with a fixed source epoch and compare its complete
output with the last approved Handlebars result:

```text
SOURCE_DATE_EPOCH=1785542400 pannonico build converted-site
```

Review every changed path, not only rendered HTML. JSON, CSS, JavaScript,
images, fonts, copied files, and generated `sitemap.xml` are part of the
migration result.
