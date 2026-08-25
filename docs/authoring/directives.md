# HTML directives

Pannonico directives are build-time HTML attributes. They let a rendered page
request a specific Pannonico transformation without adding project settings or
template functions. Directive names use the reserved `pannonico-` prefix and
are removed before successful HTML is published.

The only implemented directive is `pannonico-inline-css`. The reserved syntax
is shared so later commands, including possible image transformations, can use
the same recognition, diagnostics, source editing, and final-output guarantee.
No other directive is currently available.

## Syntax

A directive must be an actual HTML attribute on an allowed element:

```html
<style pannonico-inline-css>
  .notice { color: #b2452d; }
</style>

<link rel="stylesheet" href="/styles/site.css" pannonico-inline-css>
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

## Current directive

| Directive | Allowed elements | Free | Pro |
| --- | --- | --- | --- |
| `pannonico-inline-css` | `style`, stylesheet `link` | Removes the directive, preserves the stylesheet, and emits one `CSS_INLINING_IGNORED` warning per build. | Inlines supported CSS and removes or replaces the selected source. |

The detailed stylesheet source, cascade, selector, URL, residual-CSS, Vite,
and resource-limit rules are in [Generic CSS inlining](../vite/css-inlining.md).

## Reserved namespace and errors

Every actual `pannonico-*` attribute belongs to Pannonico. A build fails when:

- the name is not implemented;
- a known directive is on an unsupported element;
- the same directive occurs more than once on one start tag;
- its authored start tag cannot be edited safely; or
- the directive remains after command handling and optional HTML formatting.

Pannonico validates directives after template and layout rendering, before it
executes directive commands. It audits the result again after optional HTML
beautification or minification and before final HTML validation. A failed page
is not published, and a failed build does not replace the prior output tree.

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
