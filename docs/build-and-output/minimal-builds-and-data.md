# Minimal builds and external data

Pannonico can build one HTML or Markdown source without an empty project tree:

```sh
pannonico build article.md --out dist
pannonico build article.html --data ./content-data --out dist
```

`.html`, `.md`, and `.markdown` are supported page suffixes. A positional file
uses its parent as the project and configuration boundary. `--pages` and
`paths.pages` may also select one supported file. A positional file and
`--pages` cannot be combined.

When no page path was authored, Pannonico uses an existing conventional
`pages/` directory. If that directory is absent, it scans supported page files
immediately inside the project root. The fallback is shallow: it does not copy
package files, configuration, assets, or nested directories. An existing empty
`pages/` remains a valid structured project and does not activate fallback.

Missing conventional `layouts/`, `partials/`, and `data/` directories are
empty. An explicitly configured or flagged source must still exist and have
the expected type. When no layout exists and neither config nor frontmatter
selects one, a page renders without a layout. Layout-free Markdown produces an
HTML fragment; final HTML validation may warn that it lacks a document shell.

## Destination selection

A native ad hoc build asks for a destination when input and output are
terminals and neither `--out` nor `paths.output` was authored:

```text
Output directory [dist]:
```

Enter a project-relative path or press Enter for `dist`. Structured projects,
WASI, CI, redirected streams, `--quiet`, and `--dry-run` never prompt and use
the normal `dist` default.

`.` is a narrow ad hoc exception. It accepts generated pages only: no copied
files, page JSON copies, or Vite artifacts. Every final target must be absent.
An HTML source therefore cannot replace itself, while `article.md` may create
an absent sibling `article.html`. Pannonico stages and verifies the complete
set, installs files without replacement, and identity-checks rollback. This
mode cannot make several files visible as one atomic tree; ordinary output
directories retain complete-tree atomic replacement.

## Local invocation data

`--data PATH` selects one local data directory for the invocation and replaces
`paths.data`. Absolute paths are accepted on native builds. Relative paths
resolve from the shell working directory, not from a custom config file:

```sh
pannonico build article.html --data ../shared-data --out dist
```

JSON and YAML files retain nested-path identifiers under `.data`. Pannonico
uses the same strict decoding, identifier, collision, symlink, and merge rules
as project data. Native Pro watch does not accept invocation data; configure a
project-relative `paths.data` directory for watch.

WASI can use only a directory visible inside its one host preopen. Its launcher
confines absolute and relative data paths before starting the module.

## Pro HTTPS data

Only native Pro provides remote data and advertises `remote-data`. Use one URL
per flag occurrence and repeat the flag for additional documents:

```sh
pannonico build article.html \
  --data-url https://example.test/site.yaml \
  --data-url https://example.test/navigation.json \
  --out dist
```

Commas remain URL characters; they never split one flag value. When at least
one flag is supplied, the complete flag list replaces configured URLs.
Configuration supports the equivalent list:

```yaml
version: 1

data:
  urls:
    - https://example.test/site.yaml
    - https://example.test/navigation.json
```

Each decoded final filename becomes one top-level `.data` identifier. Remote
and local identifiers share collision checks. URLs must use HTTPS, contain no
credentials, query, or fragment, and end in `.json`, `.yaml`, or `.yml`.
Pannonico accepts at most 16 URLs, 8 MiB per response, and 32 MiB total. It
uses a 15-second request timeout, follows at most three policy-compliant
redirects, requires a 2xx response, loads sequentially, and honors build
cancellation. Downloaded bytes remain in memory.

Free and both WASI editions omit `--data-url`. They accept `data.urls` as known
schema but return `CAPABILITY_UNSUPPORTED` before discovery, Vite, rendering,
or output. Remote data is also excluded from Pro watch in this phase.

## Minimal scaffold and Vite

Create only a schema marker when a source file is otherwise enough:

```sh
pannonico scaffold --min .
```

This writes only `pannonico.yaml` with `version: 1`. `--min`, `--empty`, and
`--vite` are mutually exclusive. Existing known files still require `--force`.

The generated Vite config uses Pannonico defaults and starts with the smaller
contract below, plus native process commands when the selected profile needs
them:

```yaml
version: 1

vite:
  entries:
    app: src/app.ts
```

Database connectors and the possible `layouts` to `templates` rename are
separate future designs. Neither is implied by the local or HTTPS data loader.
