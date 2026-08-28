# Template navigation

Pannonico builds one read-only navigation hierarchy from every discovered HTML
and Markdown page after frontmatter and sidecars are resolved. Pages excluded
only from `sitemap.xml` remain in the hierarchy. Routed-out sources do not.
Navigation needs no configuration and creates no `nav.json` or other output.

## Start with `tree`, `current`, and `parent`

Every page and its selected layout receive the same navigation root:

```text
.nav.tree       canonical root directory
.nav.current    current page
.nav.parent     directory containing the current page
```

Directories keep immediate child directories in `c` and direct pages in `p`.
The short names mean directory and page:

```html
<a href="{{.nav.tree.p.index.url}}">Home</a>
<a href="{{.nav.tree.c.guides.p.index.url}}">Guides</a>
<a href="{{.nav.tree.c.guides.p.install.url}}">Install</a>
```

An index is an ordinary page named `index`. It appears only when an authored
`index.html`, `index.md`, or `index.markdown` exists in that directory. Guard an
optional index with the existing `has <object> <dot-path>` helper:

```html
{{if has .nav.tree.c.reference.p "index"}}
  <a href="{{.nav.tree.c.reference.p.index.url}}">Reference</a>
{{end}}
```

A page and directory may have the same name because `p` and `c` are separate:

```text
pages/guide.html        -> .nav.tree.p.guide
pages/guide/index.html  -> .nav.tree.c.guide.p.index
```

## Node fields

A directory exposes these fields:

| Field       | Meaning                                                                   |
|-------------|---------------------------------------------------------------------------|
| `key`       | Encoded key used in the parent directory's `c` object; empty at the root. |
| `name`      | Authored directory segment; empty at the root.                            |
| `path`      | `/` at the root, otherwise the slash-terminated authored hierarchy path.  |
| `c`         | Immediate child directory nodes.                                          |
| `p`         | Pages directly inside this directory.                                     |
| `ancestors` | Directory nodes ordered from the root through the immediate parent.       |
| `parent`    | Canonical containing directory; omitted only at the root.                 |

A page exposes these fields:

| Field       | Meaning                                                                         |
|-------------|---------------------------------------------------------------------------------|
| `key`       | Encoded extension-free page name used in the containing directory's `p` object. |
| `name`      | Authored extension-free page name.                                              |
| `path`      | Slash-separated page path without the source extension.                         |
| `url`       | Public route derived from the final page output.                                |
| `data`      | The same resolved object that the referenced page receives as `.page`.          |
| `parent`    | Canonical containing directory; always present.                                 |
| `ancestors` | Directory nodes ordered from the root through `parent`.                         |

Directories do not have implicit page data. Pages do not receive `.local`,
`.layout`, `.pannonico`, source paths, or rendered content through navigation.

For a page at `pages/guides/setup/install.html`, parent and breadcrumb access
look like this:

```html
<a href="{{.nav.parent.p.index.url}}">Setup index</a>
<a href="{{.nav.parent.parent.p.index.url}}">Guides index</a>

{{range .nav.current.ancestors}}
  {{if has .p "index"}}<a href="{{.p.index.url}}">{{.path}}</a>{{end}}
{{end}}
```

The root directory has an empty `ancestors` array and no `parent`. Use
`{{if has .nav.tree "parent"}}` before an optional step. Unguarded missing
relationships, missing `c`/`p` keys, and missing page-data keys stop rendering
with `TEMPLATE_EXECUTION_FAILED`, just like other strict template access.

Complete nodes have bounded formatting: a directory prints as
`[navigation directory <directory-path>]` and a page as
`[navigation page <page-url>]`. Formatting never recursively prints parents,
children, ancestors, or page data. Go's exported `Format` method implements
that safety boundary; `Format` is not a supported navigation field.

## Page, layout, and partial contexts

At runtime, pages and layouts receive the same exact `.nav` selector for the
page being rendered. A partial receives `.nav` only when its caller passes the
full root context, for example `{{template "menu" .}}`. Calling a partial with
`.page.card` replaces dot with that object and does not inject hidden roots.

Editor support knows an exact `current` and `parent` for page documents. A
standalone layout has an exact `tree` but only generic current-page and parent-
directory fields; completion and diagnostics suppress descendants whose page
depends on the runtime caller. A standalone partial receives inferred
navigation only when every reachable invocation explicitly forwards unchanged
dot. Calls from one page retain that page's exact `current` and `parent`.
Calls from several pages use the same conservative selector as a standalone
layout: the shared `tree` and generic current-page and parent-directory fields
remain, while page-specific descendants, provenance, and definitions are
suppressed. Any reachable replaced-dot call keeps the complete partial
ambiguous and suppresses navigation results.

Navigation completion labels are encoded keys. Completion detail and hover are
value-free and identify the authored source, plus the public route for pages:

```text
Directory · pages/v2.1/
```

```text
Page · pages/404.html
Route · /404.html
```

Definition on a page node or directory targets its authored source identity.
Definition below `PageNode.data` reuses the referenced page's conservative
frontmatter/sidecar source set and returns a location only when exactly one
source is known. Editor snapshots and logs retain structure, identities, and
routes, never authored scalar page-data values.

Certain direct-path errors use these messages and underline only the first
unavailable segment:

```text
Navigation node "/" has no parent.
Unknown Pannonico navigation path: .nav.tree.c.missing
```

The language server recomputes these certain paths for all saved pages,
layouts, and inferred full-root partials after a page or routing save. Deleting
or renaming a referenced page therefore marks every affected saved source,
including closed files, and restoring the page clears those findings. The
strict renderer and MCP tools use the same navigation graph; a direct failure
appears there when execution reaches the action.

Caller-relative layout paths, ambiguous partial paths, and incomplete
remote-data paths are not diagnosed.

## Identifier encoding reference

Common ASCII names stay readable. ASCII letters and non-leading digits are
unchanged, ordinary hyphens become `_`, authored underscores become `__`, and
an authored leading digit receives a framework `_` guard:

| Authored segment | Navigation key             |
|------------------|----------------------------|
| `team`           | `team`                     |
| `about-us`       | `about_us`                 |
| `about_us`       | `about__us`                |
| `404`            | `_404`                     |
| `_404`           | `__404`                    |
| `__404`          | `____404`                  |
| `2026-report`    | `_2026_report`             |
| `v2.1`           | `v2_x2e1`                  |
| `v2_x2e1`        | `v2__x2e1`                 |
| `about us`       | `about_x20us`              |
| `česta-pitanja`  | `_u00010desta_pitanja`     |
| `日本語`          | `_u0065e5_u00672c_u008a9e` |
| `_u00010d`       | `__u00010d`                |
| `--`             | `_x2d_`                    |
| `-x2e`           | `_x2dx2e`                  |
| `-u00010d`       | `_x2du00010d`              |
| `-404`           | `_x2d404`                  |
| `parent`         | `parent`                   |

The full deterministic grammar is:

1. Require one non-empty valid UTF-8 segment without NUL, `/`, or `\`.
2. Normalize the authored segment to Unicode NFC.
3. Keep ASCII letters and digits, double every authored underscore, encode
   other ASCII as `_xHH` with two lowercase hexadecimal digits, and encode
   non-ASCII Unicode scalar values as `_uXXXXXX` with six lowercase digits.
4. Encode a hyphen as readable `_` unless the encoded suffix would make it look
   like `__`, `_xHH`, `_uXXXXXX`, or the whole-segment leading-digit guard. Use
   `_x2d` only at that ambiguity boundary.
5. Prefix `_` when the authored normalized segment begins with an ASCII digit.

For the exact hyphen decision, let `S` be the already encoded suffix. Use
`_x2d` when `S` starts with `_`, with lowercase `x` plus two lowercase hex
digits, with lowercase `u` plus six lowercase hex digits, or when the hyphen is
first and `S` starts with an ASCII digit. This is why `about-us` stays readable
while `--`, `-x2e`, `-u00010d`, and `-404` need the disambiguating token.

Public keys preserve authored ASCII case. Sibling collision checks separately
compare NFC-normalized authored text after Unicode lower-casing. Consequently,
case-only siblings and canonically equivalent names such as composed `é` and
decomposed `e` plus U+0301 intentionally collide instead of receiving an
order-dependent suffix. A page and directory with the same key still coexist
because they occupy separate `p` and `c` objects.

Every valid segment in this contract is directly addressable with dot syntax.
There is no Punycode, percent encoding, hash/counter suffix, production decoder,
reserved-name prefix, `.nav.routes`, `children`, `node.page.data`, alternate
`get`-only navigation grammar, generated navigation file, or navigation
configuration. Names such as `parent`, `data`, `tree`, `c`, `p`, and `Format`
remain valid authored keys inside `c` or `p`; the v1 reserved-name set is empty.

`NAVIGATION_IDENTIFIER_INVALID` is limited to malformed segment or internal
adapter inputs. `COLLISION_NAVIGATION_KEY` reports all claimants for a genuine
same-collection NFC/case collision. A future approved site-hierarchy API must
reuse this encoder and the same `c`/`p` grammar.
