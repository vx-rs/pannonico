# Generic CSS inlining

Pannonico Pro can move selected static CSS declarations into rendered element
`style` attributes. Selection uses the shared
[`pannonico-inline-css` directive](../authoring/directives.md), runs identically in Pro native
and Pro WASI, and has no project setting or command-line flag. It is a generic
web-document transform; it does not claim email-client compatibility.

## Select a stylesheet

Add the directive to each source that a page should consume:

```html
<style pannonico-inline-css>
  .notice { color: #b2452d; }
</style>

<link
  rel="stylesheet"
  href="/styles/site.css"
  pannonico-inline-css
>
```

Unselected sources remain ordinary HTML. The directive is valid only on
`style` and `link` elements; using it on another element is an
`HTML_DIRECTIVE_INVALID` error. Names are ASCII case-insensitive, and a value,
when present, is ignored. The common syntax and reserved-namespace rules are in
[`directives.md`](../authoring/directives.md).

In Pro, a selected link must be an enabled, non-alternate stylesheet with one
non-empty `href`. Selected sources cannot
use a non-empty `title`, conditional `media` other than `all`, or a link
`integrity` attribute. `type`, when present, must be `text/css`. These cases
fail instead of changing browser behavior silently.

Free does not inline CSS. It keeps each selected `style` or `link` element and
its stylesheet behavior, removes the Pannonico directive from final HTML, and
emits one non-fatal `CSS_INLINING_IGNORED` warning per build regardless of how
many pages contain directives. The warning has no source or `Help` field. Output
formatting and final validation still run, the build report remains successful,
and both normal build and dry run exit with status `0` when no error exists.

Earlier development configs that contain the removed `css.inline` setting now fail strict
configuration loading with `CONFIG_UNKNOWN_FIELD`. Delete the complete `css`
block; the directive is the only CSS-inlining control.

## Source boundary

Pro prepares one immutable source index for the build and resolves a selected
link only from:

- regular `.css` files already discovered for pass-through publication; and
- CSS artifacts reachable from configured entries in a production Vite
  snapshot.

The inliner performs no filesystem, process, or network I/O. It never fetches a
remote URL, follows `@import`, or scans mutable Vite output while pages render.
An absolute CDN URL is usable only when that exact public URL already identifies
an artifact in the immutable Vite snapshot. Otherwise it fails as remote or
unavailable input.

The source index is prepared automatically because the compiled runtime
contains the Pro inliner; it is not configuration-gated. Linked CSS is compiled
lazily on first selection and then reused within that build. Embedded CSS is
compiled for its document occurrence. Copied CSS bytes also participate in
publication's expected-byte check, so a source changed after inlining prevents
output replacement. Free does not prepare or read this CSS source index.

## Static cascade behavior

The first release inlines selectors composed from type, class, ID, universal,
and attribute selectors; compound selectors; and descendant, child, adjacent-
sibling, and general-sibling combinators. Selector lists are processed one
branch at a time.

Pannonico orders directly matched declarations by `!important`, existing
inline-style authority, selector specificity, selected stylesheet order, rule
order, and declaration order. It keeps repeated properties, fallback values,
and shorthand/longhand sequences rather than reducing declarations to a
property map. Existing `style` declarations join that ordering only when the
element is matched by selected CSS.

This is a static DOM transform. Pseudo-classes, pseudo-elements, namespace
selectors, at-rules, nested CSS rules, and selectors that match no authored
element are not inlined. At-rules and unsupported or unmatched selector
branches remain as normalized residual CSS at the selected source's original
position. CSS nesting is rejected because the pinned parser cannot preserve it
safely; compile nesting with Sass, Lightning CSS, or Vite before selection.
`@import` is rejected rather than retained because it would require another
source-loading policy.

Pannonico does not execute JavaScript, compute browser styles, propagate
inherited values, or resolve custom properties. It preserves declarations such
as `var(--accent)` for the browser. Rules needed by elements created later by
JavaScript must remain in an unselected stylesheet or in residual CSS.

If every selected rule is consumed, the selected source node is removed. If
residual behavior remains, Pannonico replaces the source at the same position
with a directive-free `<style>` element. Applicable `nonce`, `media`, and `type`
attributes and source-order `/*! ... */` license comments are retained.
Unchanged HTML token ranges keep their authored bytes.

## URLs and Vite

Relative `url(...)` values in linked CSS are resolved against the public
stylesheet URL before they move into an element or residual `<style>` block.
Root-relative, absolute, protocol-relative, data, and fragment URLs keep their
existing form. Embedded CSS has no external stylesheet base, so its URLs are
left unchanged.

In production, mark Vite CSS only after testing `.pannonico.vite.mode`:

```html
{{with .pannonico.vite}}
  {{$vite := .}}
  {{with get .entries "app"}}
    {{range .css}}
      {{if eq $vite.mode "production"}}
        <link rel="stylesheet" href="{{.}}" pannonico-inline-css>
      {{else}}
        <link rel="stylesheet" href="{{.}}">
      {{end}}
    {{end}}
  {{end}}
{{end}}
```

A Vite development snapshot exposes server URLs, not immutable compiled CSS
bytes. Leaving development links unselected also preserves Vite CSS HMR. The
compiled production CSS and its referenced assets remain published even after
the selected link is consumed; this release does not prune shared assets.

## Pipeline and validation

The Pro page order is:

1. render the page and selected layout;
2. validate actual Pannonico directives;
3. inline selected CSS;
4. apply optional Pro `--beautify` or `--minify` output formatting;
5. audit that no directive remains;
6. validate the resulting HTML;
7. publish the complete immutable output plan.

There is no separate HTML validation pass before inlining. A CSS or localized
HTML rewrite failure prevents publication, and dry run reports the same failure
without changing output.

In Free, localized directive removal occupies step 3 instead. It happens before
formatting and the final audit. If Pannonico cannot prove the attribute edit
safe, it reports `HTML_DIRECTIVE_REWRITE_FAILED` and discards the page's
partial bytes. CSS-engine-specific localized rewrite failures in Pro retain
`CSS_HTML_REWRITE_FAILED`.

## Fixed limits

Limits are fixed product safeguards rather than configuration:

- 8 MiB per selected stylesheet;
- 32 MiB of selected CSS per document;
- 100,000 selector branches;
- 500,000 declarations;
- 256 tokens in one selector branch; and
- 50,000,000 selector-to-element candidate pairs per document.

Selected CSS must be valid UTF-8 without NUL bytes. An optional UTF-8 BOM and
initial UTF-8 `@charset` are accepted; other encodings are rejected.

## Email output is separate

Generic inlining can be useful while authoring an email document, but it does
not add legacy presentation attributes, client-specific compatibility rules,
absolute-asset policy, MIME generation, delivery, or provider integration. A
future Pro email profile may build on this engine only after a separate plan,
compatibility policy, and test matrix are approved.
