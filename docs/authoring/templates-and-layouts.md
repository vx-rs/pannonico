# Templates and layouts

Pannonico parses Go `html/template` sources, registers layouts and partials,
validates partial dependencies, and selects one layout for each page before
execution. Parsing does not mark content as trusted HTML or write output.

Execution behavior is documented in [`rendering-context.md`](rendering-context.md),
and the non-localization helpers and migration examples are documented in
[`core-template-helpers.md`](core-template-helpers.md).
The read-only site hierarchy and its complete identifier encoding are
documented in [`navigation.md`](navigation.md).

## Automatic names

Pannonico derives names from clean paths relative to the owning source root.
It removes the exact lower-case `.html` extension and preserves slash-separated
directories and authored case.

```text
partials/navigation.html       -> navigation
partials/components/card.html  -> components/card
layouts/default.html           -> default
layouts/blog/article.html      -> blog/article
```

Pages have no callable template name. Their project-relative source path is
used only for parsing identity and diagnostics.

Names must be relative, lexically clean, and slash-separated. References and
layout selections are exact and case-sensitive. Collision checks use a
Unicode lower-case comparison key, so `Card.html` and `card.html` collide even
on a case-sensitive host.

Layout and partial names use separate namespaces. A layout and a partial may
both be named `shared`. A `template` action resolves only the partial named
`shared`; layout selection resolves only the layout named `shared`.

## Template syntax and definitions

Every page, layout, and partial body is parsed independently with Go
`html/template`. Pannonico assigns all names, so source files must not contain
`define` or `block` declarations.

Markdown pages are converted before this parse step. HTML pages, layouts, and
partials may contain explicit compile-time Markdown blocks. See
[`markdown.md`](markdown.md) for ordering, safety, and directive syntax.

The parser registers placeholders for the approved V1 helpers:

```text
date
get
has
markdown
pageIs
plural
t
```

The placeholders only allow syntax validation before execution. Execution
replaces all placeholders with real functions for
every fresh execution tree.

## Partial references

Pages and layouts may invoke partials. Partials may invoke other partials.

```html
{{template "navigation" .}}
{{template "components/card" .page.featuredItem}}
```

Every `template` action is interpreted as a partial reference. A page or
partial therefore cannot invoke a layout through Go template syntax. Layouts
are selected only through page frontmatter and project configuration.

Preflight parses actions inside `if`, `range`, `with`, and their `else`
branches. A missing partial reports the referring source and the action's
one-based line and column when Go exposes them.

The complete partial graph is validated, including partials that no page or
layout currently uses. A self-reference or multi-partial cycle fails
preflight. The diagnostic includes a closed dependency chain such as:

```text
first -> second -> third -> first
```

## Layout selection

Each valid page receives one selection in discovery order:

1. Use the exact page frontmatter `layout` value when present.
2. Otherwise use `templates.defaultLayout` from configuration.
3. Exact `layout: none` disables layout rendering for that page.

If no layouts exist and neither config nor page frontmatter explicitly selects
one, Pannonico also disables layout rendering. This is the implicit ad hoc
case; authored layout choices remain strict errors when missing.

The default configuration value is `default`. Nested names such as
`blog/article` are valid. Every selected name other than exact `none` must
exactly match a discovered layout source. A case-only mismatch is missing
rather than being silently corrected. A selected source with invalid template
syntax reports its parse error without a second missing-layout diagnostic.

The configured default is required only when at least one page selects it. A
site whose pages all select another layout or exact `layout: none` does not
need `layouts/default.html`.

The language server retains exact literal template and selected-layout
dependencies for saved sources. Deleting `partials/components/card.html` marks
every saved page, layout, or partial containing
`{{template "components/card" .}}` with `TEMPLATE_MISSING_PARTIAL`. Deleting
`layouts/default.html` marks every page that explicitly or implicitly selects
`default` with `LAYOUT_MISSING`. These are Error diagnostics for closed and open
saved files; restoration clears them after the next reindex. Dynamic template
names and a standalone partial's caller-dependent data context are not guessed.

## Preflight and source safety

The immutable content snapshot supplies copied page and layout bodies. The
build rereads discovered partials through the same source boundary used
for other source content: it rejects symlinks and non-regular files, compares
the opened file with the pre-open identity, and revalidates the path after the
read.

Parsed trees remain private to the build. Inspected reference lists and layout
selections are copies. Template preflight creates no staging directory and
performs no output mutation.
