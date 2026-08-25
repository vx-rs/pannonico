# Source discovery

Discovery validates the selected pages source and the configured `layouts`,
`partials`, and project `data` roots. `pages` may be one supported file or a
directory. Missing conventional layout, partial, and data roots are empty;
explicit missing roots remain errors. Empty existing roots are valid.
Discovery reads directory metadata only; it does not read file contents or
create output.

When the project contains `.pannonico`, discovery resolves each considered
regular file before root-specific classification. The effective `pannonico`
mode uses the classifications below, `copy` creates an opaque copied file, and
`vite` or `exclude` omits the processing candidate. Routing does not expand the
configured source roots or the shallow root-page fallback. See
[`file-routing.md`](file-routing.md).

With no authored page path, Pannonico uses an existing `pages/` directory. If
it is absent, discovery scans only immediate `.html`, `.md`, and `.markdown`
files in the project root. It neither recurses nor copies unrelated root files.
An existing empty `pages/` directory does not activate fallback.

## Nested project isolation

A regular, non-symlink `pannonico.yaml` or `.pannonico` file below the selected
root marks an independent child project. The deepest marked root owns each
file. Discovery records only a project's direct children and stops walking at
each boundary; pruning a direct child also excludes all of its descendants.
Marker contents are not read during this boundary scan, so a malformed child
configuration still isolates its complete subtree.

```text
site/                         parent root
|-- pannonico.yaml
|-- data/site.yaml            parent data
`-- pages/
    |-- index.html            parent page
    `-- docs/                 child root
        |-- pannonico.yaml
        |-- data/site.yaml    child data
        `-- pages/index.html  child page
```

Building `site` excludes `pages/docs` from pages, layouts, partials, global and
page-local data, navigation, copied assets, localization, IDE indexing, and
watch input. Building `site/pages/docs` loads only the child's configuration
and conventions. Configuration, data, templates, navigation, remote sources,
Vite settings, and output are not inherited in either direction.

An invocation `--data` directory may contain a child boundary and is pruned in
the same way. Explicitly selecting a config, source root, languages file, or
invocation-data root at or below a child is rejected instead of silently
changing ownership.

## Classification

Extensions are exact and case-sensitive.

| Root     | File                     | Classification         | Output candidate                                          |
|----------|--------------------------|------------------------|-----------------------------------------------------------|
| pages    | `.html`                  | rendered page          | exact relative path                                       |
| pages    | `.md`                    | rendered Markdown page | relative path with `.md` replaced by `.html`              |
| pages    | `.markdown`              | rendered Markdown page | relative path with `.markdown` replaced by `.html`        |
| pages    | `.yaml`, `.yml`          | page-local data        | none                                                      |
| pages    | `.json`                  | page-local data        | exact relative path, copied unchanged by site publication |
| pages    | every other regular file | copied file            | exact relative path                                       |
| layouts  | `.html`                  | layout                 | none                                                      |
| partials | `.html`                  | partial                | none                                                      |
| data     | `.json`, `.yaml`, `.yml` | global data            | none                                                      |

Layouts, partials, and global data are strict roots. Any other regular file in
those roots fails discovery. Move a pass-through file under pages.

For example, `pages/about.html` and `pages/about.md` both target `about.html`
and therefore collide, while `pages/ABOUT.MD` is copied.
If their output paths differ only by case, discovery reports both source and
output collisions. This behavior does not vary with the host filesystem.

## Exact identities

Every candidate records:

- its owning source root;
- an OS-native absolute path for later I/O;
- a slash-separated path relative to the project root;
- a slash-separated path relative to its source root;
- a case-insensitive source collision key.

Rendered pages and pass-through files also record an output path relative to
the configured output root. Pass-through files include copied assets and JSON
page data. Discovery preserves the exact relative path. It does not rewrite
`about.html` to `about/index.html`.

Every rendered page also records one public URL path derived from that output
identity. Root `index.html` maps to `/`; a nested `index.html` maps to its
directory route with a trailing slash; every other HTML target maps to the same
rooted path. Sitemap planning consumes this authoritative `URLPath` rather than
re-deriving routes from source filenames. See [`sitemap.md`](sitemap.md).

For a rendered `pages/blog/article.html`:

```text
sourcePath   pages/blog/article.html
relativePath blog/article.html
outputPath   blog/article.html
pagePath     blog/article
pageName     article
urlPath      /blog/article.html
```

The same page identity applies to `pages/blog/article.md` and
`pages/blog/article.markdown`; only its source path and mapped `.html` output
extension differ.

## Built-in ignores

Discovery ignores:

- every non-root file or directory whose name begins with `.`;
- regular files whose names end with `.tmp`;
- regular files whose names end with `.swp`;
- regular files whose names end with `~`.

Patterns are exact and case-sensitive. There is no configurable ignore file in
V1. A hidden directory is skipped recursively.

Discovery checks an entry for symlink type before it applies ignore rules. A
hidden or temporary-named symlink therefore fails instead of being ignored.
Regular hidden and temporary files are ignored before routing, so a rule cannot
restore them.

## Symlinks and other file types

V1 does not follow symlinks. Discovery checks each configured source-root path
component with `lstat` and rejects symlinked components. It also rejects every
symlink encountered while walking a source root.

Only regular files and directories are supported. Sockets, named pipes,
devices, and other file types fail discovery.

Later content readers must handle filesystem changes between discovery and
reading. Output planning must revalidate physical targets immediately before
staging or promotion.

Publication revalidates those paths and also rejects portable filename hazards
and file-versus-directory target conflicts before staging. Page JSON is
reread and compared with the immutable bytes consumed by content preflight;
other copied files are read for the first time at that boundary. The complete
publication contract is in [`site-output.md`](site-output.md).

## Collisions and ordering

Discovery normalizes collision keys by replacing `\` with `/`, cleaning lexical
segments, and applying Unicode lower-case conversion. It reports:

- project-relative source paths that share a normalized key;
- output-relative rendered or copied paths that share a normalized key.
- rendered public routes that share a normalized key.

One diagnostic represents each collision group. It names the primary source,
all related sources, the normalized key, and each candidate role. Candidates
and diagnostics are deterministic across repeated runs.

An invocation-selected `--data` directory is loaded after discovery and does
not make an external directory part of the project inventory. Its documents
still enter the ordinary `.data` identifier and collision rules. See
[`minimal-builds-and-data.md`](minimal-builds-and-data.md).
