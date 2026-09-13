# HTML directives

Pannonico directives are build-time HTML attributes. They let a rendered page
request a specific Pannonico transformation without adding project settings or
template functions. Directive names use the reserved `pannonico-` prefix and
are removed before successful HTML is published.

Pannonico implements `pannonico-inline-css` and `pannonico-verbatim`. The first
selects stylesheets for CSS inlining. The second keeps the source inside a
wrapper outside Pannonico's template and HTML processing.

## Syntax

A directive must be an actual HTML attribute on an allowed element:

```html
<style pannonico-inline-css>
  .notice { color: #b2452d; }
</style>

<link rel="stylesheet" href="/styles/site.css" pannonico-inline-css>

<pre pannonico-verbatim><code>{{template "shell/header"}}</code></pre>
```

Names are ASCII case-insensitive, as HTML attribute names are. The canonical
spelling in authored templates and documentation is lowercase. Boolean and
valued forms have the same meaning; the value is ignored:

```html
<style pannonico-inline-css>...</style>
<style pannonico-inline-css="true">...</style>
```

Use the Boolean form unless a template-writing tool requires a value.

Directive-looking text in a comment, script, style body, or ordinary text node
is not an attribute and does not execute:

```html
<!-- <style pannonico-inline-css> -->
<script>const example = "<link pannonico-inline-css>";</script>
```

## Current directives

| Directive | Elements | Free | Pro |
| --- | --- | --- | --- |
| `pannonico-inline-css` | `style`, CSS `link` | Preserves CSS | Inlines CSS |
| `pannonico-verbatim` | Paired element | Emits inner source literally | Same as Free |

In Free, `pannonico-inline-css` removes its attribute, preserves the stylesheet,
and emits one `CSS_INLINING_IGNORED` warning per build. Pro inlines supported
CSS and removes or replaces the selected source. The detailed stylesheet
source, cascade, selector, URL, residual-CSS, Vite, and resource-limit rules are
in [Generic CSS inlining](../vite/css-inlining.md).

## Literal Pannonico source

Use `pannonico-verbatim` when an HTML template must contain source that looks
like a Pannonico action but must not be parsed or executed:

```html
<pre pannonico-verbatim><code>{{template "shell/header"}}</code></pre>
```

The generated HTML is:

```html
<pre><code>{{template "shell/header"}}</code></pre>
```

Pannonico removes only the directive attribute. It keeps the exact inner bytes
opaque through Go template parsing, other Pannonico directives, Pro HTML
transforms, and HTML validation, then restores them in the final output. A
partial can hold the wrapper when several pages use the same example; direct
use in a page or layout works the same way.

The directive controls Pannonico processing, not browser parsing. The browser
still interprets restored tags as HTML. Encode `<` and `>` when the page should
display HTML markup as text.

A non-self-closing wrapper must have an explicit matching closing tag. An
unclosed wrapper fails the build because Pannonico cannot determine where the
literal region ends. The outer wrapper owns any directive-looking markup
inside it; nested `pannonico-verbatim` text is emitted literally.

## Reserved namespace and errors

Every actual `pannonico-*` attribute belongs to Pannonico. A build fails when:

- the name is not implemented;
- a known directive is on an unsupported element;
- the same directive occurs more than once on one start tag;
- its authored start tag cannot be edited safely; or
- a `pannonico-verbatim` wrapper has no explicit matching closing tag; or
- the directive remains after command handling and optional HTML formatting.

Pannonico consumes `pannonico-verbatim` from authored source before template
parsing. It validates rendered directives after template and layout rendering,
before it executes their commands. It audits the result again after optional
HTML beautification or minification and before final HTML validation. Literal
contents are restored only after that validation. A failed page is not
published, and a failed build does not replace the prior output tree.

The stable diagnostic codes are:

- `HTML_DIRECTIVE_UNKNOWN` for an unimplemented reserved name;
- `HTML_DIRECTIVE_INVALID` for wrong placement, duplicates, or malformed
  directive syntax;
- `HTML_DIRECTIVE_RENAMED` for the removed pre-release name; and
- `HTML_DIRECTIVE_REWRITE_FAILED` when safe removal, command consumption, or
  the final audit fails.

Command-specific failures retain command-specific codes. For example, invalid
selected stylesheet semantics and CSS parsing still use the `CSS_*` codes.
See [Diagnostics](../reference/diagnostics.md) for the complete list.

## Migration from the pre-release name

Replace the old attribute everywhere:

```diff
- <style data-pannonico-inline-css>
+ <style pannonico-inline-css>
```

`data-pannonico-inline-css` is not an alias. An actual legacy attribute fails
with `HTML_DIRECTIVE_RENAMED` and names the replacement. This strict boundary
prevents old templates from silently retaining private build controls.

## Adding a future directive

The shared namespace is not a plugin registry. A new directive requires an
explicit implementation in Pannonico, an allowed-element and value contract,
edition behavior, stable diagnostics, command-level tests, final-output tests,
and public documentation. Until that work exists, its `pannonico-*` name is an
unknown directive and fails safely.
