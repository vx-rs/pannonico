# Native Pro capabilities

The [`Free vs Pro`](free-vs-pro.md) comparison describes the product boundary.
This document defines the technical behavior of Pro capabilities.

Pro is a compile-time product selection. It cannot be enabled through project
configuration, a command flag, or an environment variable. Use a distributed
Pro product when these capabilities are required.

## Rich Markdown

Pro native and Pro WASI advertise `rich-markdown` version 1 and compile the
anchor, footnote, abbreviation, container, subscript, superscript, mark,
insertion, deletion, and fenced-code highlighting plugins. An explicit group
request selects all ten unless individual fields override the group baseline.
Base Markdown remains selected until project configuration or page frontmatter
explicitly sets `enabled: true` or an individual feature to `true`. A feature
set to `true` requests Rich Markdown even when the same object has
`enabled: false`. Free parses the same strict schema, but an explicit request
returns `CAPABILITY_UNSUPPORTED` with status `4`; Free does not link the
implementations.

Disabled plugins install no parser, AST transformer, or renderer work. The
footnote plugin consolidates executed page, layout, partial, block, and helper
notes into one final first-reference-ordered section at the end of the page
content supplied to its layout. Disabled footnotes emit no placement marker and
perform no document scan. An enabled page carries one opaque marker so final
layout execution can determine the exact content boundary even when the page
contains no note. The complete syntax and resolution contract is in
[`markdown.md`](../authoring/markdown.md).

Containers emit only stable `pannonico-container` and optional
`pannonico-container--name` CSS hooks; Pannonico provides no default container
theme. Invalid nonempty names warn and fall back to the base class. Disabled
containers perform no container-specific parsing or warning work.

Fenced code remains available in both editions and always uses the
`pannonico-code` wrapper. Pro highlighting adds Chroma's compact token classes
for a recognized fence identifier. It emits no theme or inline style; project
CSS owns presentation. Disabling `codeHighlight` skips its factory, lookup,
tokenization, and renderer allocations for that Markdown selection. Chroma is
statically linked only into Pro, so disabling it per project or page does not
remove Pro artifact size or package initialization.

## Remote data

Native Pro advertises `remote-data` and accepts one HTTPS JSON/YAML source per
repeatable `--data-url` occurrence. `data.urls` supplies the equivalent config
list. Downloads are sequential, cancellable, held in memory, and limited by
fixed URL, redirect, timeout, response-size, and aggregate-size policies.
Decoded filenames share the ordinary `.data` collision rules with local files.
Free, Pro WASI, and watch do not fetch remote data. The exact policy is in
[`minimal-builds-and-data.md`](../build-and-output/minimal-builds-and-data.md).

## Parallel page work

`--jobs COUNT` bounds only independent per-page rendering, optional HTML
transformation, and final validation. The limit cannot exceed the host's
logical CPU count. Discovery, content and template preflight, result reduction,
and output planning remain serial. Shared complete-tree publication separately
uses at most eight native staging workers per available Go execution thread,
bounded by artifact count. Pro has no additional edition ceiling, while the
shared positive `--max-output-workers` flag can lower the pool for one build or
watch invocation. This publication cap is independent of `--jobs`.
Staged-tree verification and promotion remain serial. Results occupy slots
assigned by sorted output path, so worker completion order cannot affect bytes
or diagnostics.

## HTML output modes

Raw template output remains the default. `--beautify` and `--minify` are
explicit, mutually exclusive Pro choices. The selected transform runs after
template execution and Vite tag generation but before final HTML validation.
The validator therefore checks the exact bytes eligible for publication.

### Beautification

`--beautify` emits deterministic, readable nesting with two-space indentation,
LF line endings, no line wrapping, no incidental blank lines, and no final
newline. It preserves authored tag, attribute, entity, comment, and doctype
bytes. Contents of `code`, `pre`, `textarea`, `script`, and `style` are copied
byte for byte; SVG and MathML content is treated as opaque.

The formatter is lexical and does not build or serialize a repaired browser
DOM. Malformed structure remains visible to final validation. Reapplying it to
its own output produces the same bytes.

### Minification

`--minify` runs after template execution and before validation. The transform
collapses ASCII whitespace runs in ordinary text to one space and removes
ordinary HTML comments. It preserves authored tag and attribute bytes,
contents of `pre`, `textarea`, `script`, and `style`, conditional comments whose
trimmed content begins `[if`, and directive comments beginning `#` or `@`.

Both transformations are conservative about HTML-sensitive regions, but they
cannot infer CSS rules such as `white-space: pre` applied to an otherwise
ordinary element. Use a protected element or leave HTML transformation disabled
when authored whitespace outside the preserved elements is significant.

## Generic CSS inlining

Pro native and Pro WASI advertise `css-inlining` version 1. A rendered
`pannonico-inline-css` attribute on an embedded or linked stylesheet is
the only selection control; there is no project setting or CLI flag. Free
preserves the selected stylesheet, removes the recognized directive, and emits one
non-fatal `CSS_INLINING_IGNORED` warning per build.

The pure-Go engine uses only immutable copied or production Vite CSS. It
matches a conservative static selector subset, merges directly matched
declarations with existing inline styles, retains unsupported or unmatched
behavior as residual CSS, and rebases relative linked-asset URLs. It runs after
template/layout rendering and before either HTML output transform and final
validation. See [`directives.md`](../authoring/directives.md) for the shared HTML syntax and
[`css-inlining.md`](../vite/css-inlining.md) for the cascade, limits, Vite development,
and non-email contracts.

## Integrated development mode

```text
pannonico-pro watch --jobs 4 --beautify --host 127.0.0.1 --port 3000 SITE
```

Native Pro provides the watcher, preview server, live browser reload, and
managed configured Vite development server as one Integrated development mode.
These parts are available together rather than as separate product modes.

The polling watcher hashes only the current config, pages, layouts, partials,
data roots, and a configured standalone languages file. It also excludes the
active output, Pannonico-owned staging and backup directories, and the selected
JSON report. It waits for a quiet coalescing window and runs one build at a time.

After a successful promotion, the server confines reads beneath that output
with `os.Root`. Failed rebuilds leave the previous tree served. HTML responses
receive a small EventSource client, while files on disk remain byte-for-byte
build artifacts. Reload is broadcast only after a successful later promotion.

The default listener is loopback. `--open` uses the platform browser opener
only after the server starts. `Ctrl-C` cancels the watcher and waits for HTTP
shutdown.

When Vite is configured, watch starts the structured `devCommand` or uses an
external server, waits for `@vite/client`, and exposes development URLs through
the normal template context. Vite handles asset HMR; frontend changes do not
trigger Pannonico. A config change replaces the Vite session when needed.

## Pro WASI

Build the target-constrained Pro module explicitly:

```text
CGO_ENABLED=0 GOOS=wasip1 GOARCH=wasm \
  go build -mod=vendor -trimpath -tags=pannonico_pro \
  -o pannonico-pro.wasm ./cmd/pannonico
```

Pro WASI retains generic CSS inlining, explicit Rich Markdown, HTML
beautification, HTML minification, and the meaningful serial form `--jobs 1`.
A value greater than one requests parallel rendering and exits with status `4`
before project work. Its compiled capability metadata excludes parallel
rendering, Integrated development mode, and native process execution, and the
binary does not link their Go packages. It retains pure Vite manifest
consumption. Integrated development mode is a known product command but exits
with status `4` because the target cannot provide it.

It also omits `remote-data` and `--data-url`; a config containing `data.urls`
returns capability status `4` before build work.

Markdown pages, authored inline blocks, and the safe runtime helper use the
same pure-Go base renderer in every target. Pro WASI also composes the same
rich-Markdown plugins as native Pro.
