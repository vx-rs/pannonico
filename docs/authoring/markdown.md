# Markdown

Pannonico renders lower-case `.md` files under `pages/` to the matching `.html`
output before Go `html/template` runs. The same Markdown dialect is available
through a safe runtime helper and through explicit compile-time blocks in HTML
templates.

## Markdown pages with Go templates

`pages/guides/start.md` becomes `dist/guides/start.html`; its page identity is
`guides/start`. A `.md` page and an `.html` page that map to the same output are
an output collision. Upper-case or mixed-case extensions remain pass-through
files.

Markdown pages support frontmatter and ordinary Go template actions:

```markdown
---
title: Getting started
headlineSections: true
---
# {{.page.title}}

Welcome to **{{get .data "site.name"}}**.

{{if has .page "summary"}}{{markdown .page.summary}}{{end}}
```

Markdown conversion happens before `html/template` compilation. Pannonico
protects actions outside Markdown code, then restores them for Go to parse.
Actions inside inline, fenced, and indented code are rendered literally:

````markdown
`{{.page.title}}`

```go
{{if .page.enabled}}content{{end}}
```
````

Authored Markdown pages may contain raw HTML. That is a trusted project-source
boundary, equivalent to authored HTML templates; values later inserted by Go
templates are still contextually escaped.

## Safe runtime fragments

Use `markdown` when the Markdown text is a runtime string from frontmatter or
structured data:

```html
<section class="summary">
  {{markdown .page.summary}}
</section>
```

The helper requires a string. It disables raw HTML and dangerous URL schemes,
then returns only HTML produced by the restricted Markdown renderer. In Pro it
uses the rich-Markdown selection resolved for the current page. Footnote
definitions remain local to each helper value, while generated references join
the page's single document-level footnote section.

Do not use the helper to reinterpret template syntax stored in data. Helper
input is rendered after Go evaluates its argument and is never parsed as a
second Go template.

## Compile-time blocks in HTML templates

Use paired directive comments when an `.html` page, layout, or partial has one
authored Markdown region:

```html
<aside class="release-note">
{{/* pannonico:markdown */}}
## {{.page.releaseTitle}}

This text is **Markdown** and may contain a footnote.[^note]

[^note]: The definition is compiled with this template.
{{/* /pannonico:markdown */}}
</aside>
```

Each directive must occupy a complete logical line. Blocks cannot nest; a
missing, unmatched, or nested delimiter reports `MARKDOWN_DIRECTIVE_INVALID`
at the directive line. Directive-looking text inside a fenced code block is
literal. Inline blocks use trusted authored raw HTML. Their footnote prefixes
remain an internal request-local scope, so a partial containing a block can
repeat without sharing definitions or creating duplicate final IDs.

Put structural Go actions such as `if`, `range`, and their matching `end` on
separate lines, with the Markdown they control between them. Inline value,
helper, and partial actions may remain inside Markdown text.

## Base dialect

Both editions provide CommonMark 0.31.2, tables, automatic links, typographic
replacements, and trusted raw HTML in authored pages and compile-time blocks.
The safe runtime helper omits raw HTML. Optional syntax remains literal when
its rich-Markdown plugin is unavailable or disabled.

Inline backticks and fenced code are part of this base dialect:

~~~~markdown
Use `const` for an immutable binding.

```ts
const answer: number = 42
```
~~~~

Inline code renders as `<code>`. Every fenced block renders with
`<pre class="pannonico-code"><code>`. A tagged fence also keeps Goldmark's
escaped `language-*` class on `code`, even when syntax highlighting is
unavailable or disabled. Fenced source preserves line breaks, indentation,
tabs, trailing spaces, and HTML-sensitive text.

`headlineSections: true` wraps top-level headings and their following content
in nested `<div class="section-headline section-headline-N">` elements until
the next heading of the same or higher level. Section wrappers do not require
heading IDs.

## Explicit Rich Markdown

Pro native and Pro WASI advertise `rich-markdown` and compile ten plugins.
Base Markdown is the default in both editions. Setting `enabled: true` requests
the group with all ten features selected unless individual options override it:

| Option          | Syntax                                          | HTML or behavior                                                 |
|-----------------|-------------------------------------------------|------------------------------------------------------------------|
| `anchor`        | `# Heading`                                     | deterministic heading `id`                                       |
| `footnote`      | `text[^name]`, `[^name]: body`, `text^[inline]` | footnote section and backlinks                                   |
| `abbr`          | `*[HTML]: Hyper Text Markup Language`           | `<abbr title="…">HTML</abbr>`                                    |
| `container`     | `::: warning` … `:::`                           | `<div class="pannonico-container pannonico-container--warning">` |
| `codeHighlight` | opening fence with a `ts` identifier            | compact class-only token spans inside `.pannonico-code`          |
| `sub`           | `H~2~O`                                         | `<sub>2</sub>`                                                   |
| `sup`           | `29^th^`                                        | `<sup>th</sup>`                                                  |
| `mark`          | `==text==`                                      | `<mark>text</mark>`                                              |
| `ins`           | `++text++`                                      | `<ins>text</ins>`                                                |
| `del`           | `~~text~~`                                      | `<del>text</del>`                                                |

Configure the project with `richMarkdown`:

```yaml
version: 1
richMarkdown:
  enabled: true
  anchor: true
  footnote: true
  abbr: true
  container: true
  codeHighlight: true
  sub: true
  sup: true
  mark: true
  ins: true
  del: true
```

`enabled` sets a group baseline. An individual option in the same object then
overrides that baseline. Any individual `true` value is also an explicit Rich
Markdown request, including under `enabled: false`. Absence, `{}`, and authored
values that are all `false` do not request the capability. Page frontmatter
accepts the identical object:

```markdown
---
richMarkdown:
  enabled: false
  anchor: true
---
# This heading has an ID

==This remains literal.==
```

Resolution applies project `enabled`, project feature values, page `enabled`,
then page feature values. The result is intersected with the plugins compiled
into Pro. Free recognizes the same schema, but each explicitly requesting
source produces one `CAPABILITY_UNSUPPORTED` diagnostic and status `4` before
rendering. A project request and explicitly requesting pages are reported
separately. Inherited project enablement alone does not add a page diagnostic,
and several true fields in one object still produce one diagnostic for that
source.

Page settings apply to that page body, compile-time Markdown blocks in that
page, and `{{markdown VALUE}}` calls made while its page, partials, and layout
execute. Layout and partial compile-time blocks use project settings because
those templates are compiled once and may be shared by pages with different
frontmatter.

When the anchor plugin is enabled, Pannonico lower-cases and NFC normalizes
visible heading text, changes Unicode whitespace to `-`, retains Unicode
letters, numbers, and hyphens, trims edge hyphens, uses `section` when empty,
and suffixes duplicates starting with `-2`. Raw HTML and Go actions do not
contribute to the ID; inline code does. Anchors do not add permalinks or
`tabindex` attributes.

Markdown assigns heading IDs before Go template execution. A heading inside a
Go `range` therefore repeats its already assigned ID even when an action prints
different visible text:

```markdown
{{range .page.versions}}
## Version {{.version}}
{{end}}
```

With anchors enabled, every executed copy has `id="version"`, and strict final
HTML validation reports the duplicate. For repeated data, author ordinary HTML
with a unique, reviewed slug or restructure the page so Markdown emits the
heading once:

```html
{{range .page.versions}}
<h2 id="version-{{.slug}}">Version {{.version}}</h2>
{{end}}
```

The project owns the uniqueness and URL safety of `.slug`; Pannonico still
checks the assembled document for duplicate IDs.

Named footnote definitions may appear after their references. Inline
footnotes use `^[content]`, which takes priority over superscript parsing.
Their contents support ordinary inline Markdown, balanced link-label brackets,
and selected subscript, superscript, mark, insertion, and deletion syntax;
inline footnote syntax does not recursively nest. Named references inside a
named definition participate in the same document order and backlink model.
Definitions are numbered and emitted in first-reference order; missing named
definitions remain literal. Every executed page, layout, partial, compile-time
block, and runtime helper contributes to one group ordered by references in the
fully assembled HTML, not by template execution order. Matching labels in
different sources remain independent, and an unexecuted partial contributes
nothing. When a layout renders `.pannonico.content`, the group is the last
element of those page-content bytes. Layout-owned output such as an aside,
footer, script, or closing tag remains after it, so placement does not depend
on `</body>`. A layout that executes a footnote must include
`.pannonico.content`; otherwise the build reports a template finalization
error instead of moving the group outside the page. Layout-disabled standalone
output retains complete-document placement. Footnotes use the stable classes
`footnote-ref`, `footnotes-sep`, `footnotes`, `footnotes-list`,
`footnote-item`, and `footnote-backref`, with final document IDs such as `fn1`
and `fnref1-1`.

Abbreviation definitions are single-line, are removed from output, and use the
first definition when a label is repeated. Longer labels are matched first.
A label matches only at a document edge or beside a character that is not a
Unicode letter or number; code spans and code blocks are not changed.

Containers wrap parsed block Markdown in a stable CSS hook:

```markdown
::: Workflow Notice
This is **important**.
:::
```

```html
<div class="pannonico-container pannonico-container--workflow-notice">
<p>This is <strong>important</strong>.</p>
</div>
```

An opening fence contains at least three colons and an optional name. A
matching or longer colon-only fence closes the container; a container left
open at end of input closes automatically. Named containers can nest. Fences
inside fenced or indented code remain literal. A bare `:::` opens an unnamed
container with only `pannonico-container` and produces no warning.

Pannonico treats the complete trimmed text after the opening fence as the
name. It NFC-normalizes and lower-cases Unicode text, splits camel case,
acronym, letter-number, and number-letter boundaries, and changes runs of
spaces, punctuation, symbols, and other special characters into a single
hyphen. For example, `Important Warning`, `HTTPWarning`, and
`warning_status!urgent` become `important-warning`, `http-warning`, and
`warning-status-urgent`. A valid normalized name starts with a Unicode letter;
later characters may be Unicode letters, attached combining marks, numbers,
or single internal ASCII hyphens.

A nonempty name that cannot meet those rules, including one that starts with a
number, reports `MARKDOWN_CONTAINER_NAME_INVALID`. The build continues and
renders an unnamed container with only `pannonico-container`. Free and builds
with the container plugin disabled leave container syntax to the base Markdown
parser and do not report container-name warnings.

Pannonico intentionally supplies no container theme. Treat both classes as
project-owned CSS hooks, for example:

```css
.pannonico-container {
  padding: 1rem;
}

.pannonico-container--workflow-notice {
  border-inline-start: 0.25rem solid currentColor;
}
```

When `codeHighlight` is selected, the first whitespace-delimited info-string
word resolves through the bundled Chroma language registry. Registered names
and aliases are case-insensitive. Recognized filename and extension patterns,
such as `Dockerfile` and `main.go`, are also accepted. Pannonico does not guess
a language from code contents. An untagged fence, an unknown or overlong
identifier, a block larger than 1 MiB, or a lexer failure silently uses the
ordinary escaped fence renderer.

Highlighted output preserves the same browser-visible code text as the plain
renderer. It adds structural `.line` and `.cl` spans and compact token classes
such as `.k`, `.kr`, `.kt`, `.n`, `.nf`, `.s`, `.mi`, and `.c`. Pannonico
provides no code theme, color values, inline styles, or generated stylesheet.
Scope every compact class through the wrapper in project CSS:

```css
.pannonico-code {
  overflow-x: auto;
}

.pannonico-code .kr,
.pannonico-code .kt {
  color: var(--code-keyword);
}

.pannonico-code .s {
  color: var(--code-string);
}
```

The independent CSS-inlining capability may inline these declarations when a
project explicitly selects its own stylesheet. The theme still comes from
project CSS, not the highlighter.

Disabling `codeHighlight` or the complete group skips the highlighter factory,
language lookup, tokenization, and token-span output for that selection. A Pro
binary still contains and initializes the statically linked Chroma registry;
per-page configuration cannot remove artifact size or package startup cost.

Subscript and superscript spans are nonnested and single-line. Unescaped
whitespace rejects the span; escaping a space or punctuation removes the
backslash in the rendered value. Mark, insertion, and deletion use paired
delimiter runs with CommonMark opening and closing rules. In an odd run, the
unpaired marker remains literal.

## Migration from the TypeScript implementation

The heading-ID and footnote HTML contracts remain stable, but they now belong
to Pro rich Markdown instead of the base dialect. Rename only authored page
files that should become Markdown; layouts and partials remain `.html`.
Replace dynamic Markdown helpers with `{{markdown VALUE}}`, and use directive
blocks only for authored Markdown embedded in HTML templates.

Go template actions replace Handlebars expressions. Unlike the earlier
JavaScript helper, runtime Markdown does not pass raw HTML through. Move trusted
authored markup into a page/template or an inline block; keep user- or
data-controlled Markdown in the safe helper.

The pre-Markdown compatibility boundary is the signed `html-only` release tag.
The broader Handlebars-to-Go conversion guide is in
[`migration-from-handlebars.md`](../installation-and-updates/migration-from-handlebars.md).
