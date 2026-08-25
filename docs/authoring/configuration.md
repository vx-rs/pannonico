# Configuration

Pannonico uses one optional project file named `pannonico.yaml`. A present file
must contain `version: 1`. Unknown fields, duplicate keys, malformed YAML,
empty documents, and multiple YAML documents fail configuration loading.
Pannonico is a pre-1.0 product. Public 0.x versions are immutable, but a later
0.x release may change configuration version 1 or report schema 1. Pin the
Pannonico version, read its matching documentation, and follow the release's
migration notes. Strict cross-version compatibility begins with 1.0.0.

The separate optional `.pannonico` file contains only ordered filesystem
ownership rules. It is not YAML and does not extend this schema. See
[`file-routing.md`](../build-and-output/file-routing.md).

## Schema

```yaml
version: 1

site:
  url: https://example.com/docs

sitemap:
  enabled: true

paths:
  pages: pages
  layouts: layouts
  partials: partials
  data: data
  output: dist

images:
  optimize: true

templates:
  defaultLayout: default

localization:
  defaultLanguage: en
  languagesFile: data/languages.yaml

validation:
  html: warn

# Explicit Rich Markdown request. Available in Pro.
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

# Optional; native Pro loads these HTTPS documents.
data:
  urls:
    - https://example.test/site.yaml

# Optional. See vite-integration.md for every field.
vite:
  entries:
    app: src/app.ts
  resources:
    logo: src/logo.svg
```

Every section except `version` is optional. The zero-config defaults are:

| Setting            | Default                                                     |
|--------------------|-------------------------------------------------------------|
| pages              | `pages/`                                                    |
| layouts            | `layouts/`                                                  |
| partials           | `partials/`                                                 |
| data               | `data/`                                                     |
| output             | `dist/`                                                     |
| site URL           | unset                                                       |
| sitemap            | enabled; skipped with a warning while the site URL is unset |
| default layout     | `default`                                                   |
| default language   | unset                                                       |
| languages file     | `data/languages.yaml` when the file exists                  |
| HTML validation    | `warn`                                                      |
| image optimization | enabled                                                     |
| remote data URLs   | none                                                        |
| Rich Markdown      | not requested; base Markdown in both editions               |

`site.url` is the public HTTP or HTTPS base used for generated sitemap
locations. It may contain a clean path prefix, but not credentials, a query, or
a fragment. Pannonico removes its trailing slash. An authored invalid value is
a configuration error. `sitemap.enabled` is Boolean and defaults to `true`.
When it is enabled without `site.url`, builds still publish pages but skip the
sitemap and emit `SITEMAP_SITE_URL_MISSING`. Set `sitemap.enabled: false` to
opt out without that warning. See [`sitemap.md`](../build-and-output/sitemap.md).

`validation.html` accepts `off`, `warn`, or `error`. The checks and
full-document policy are documented in
[`html-validation.md`](../build-and-output/html-validation.md).

`images.optimize` is Boolean and defaults to `true`. It controls same-path
PNG/JPEG optimization for Pannonico-owned copied assets. See
[`image-optimization.md`](../build-and-output/image-optimization.md) for routing, preservation,
metadata, and fallback behavior.

The languages file must use a `.yaml` or `.yml` extension. Localization
metadata and language resolution are documented in
[`localization.md`](localization.md).

The optional `vite` mapping is part of the current schema version 1. It owns
resolved Vite root/output/manifest paths, required entry aliases, optional resource aliases, URL prefixes, and
structured native commands. Omitting it preserves the zero-config behavior. See
[`vite-integration.md`](../vite/integration.md).

CSS inlining is not configuration. `pannonico-inline-css` on a rendered
`style` or `link` element is the only selection control. Pro applies the
selected stylesheet; Free removes the directive, leaves stylesheet behavior
unchanged, and emits one non-fatal warning. Earlier development configs containing
the removed `css.inline` field must delete the complete `css` block. See
[`directives.md`](directives.md) for build-time HTML syntax and
[`css-inlining.md`](../vite/css-inlining.md) for the full CSS contract.

`richMarkdown` is an edition-neutral object of Boolean values. The object
requests Rich Markdown when `enabled: true` or any individual feature is
`true`. Absence, `{}`, and an object whose authored values are all `false` do
not request it. `enabled` establishes the group baseline and each feature field
overrides it after Pro authorizes the request. Free parses valid values so the
option is stable, then returns `CAPABILITY_UNSUPPORTED` with status `4` for an
explicit request. Page frontmatter can make its own later request and selection.
See [`markdown.md`](markdown.md) for syntax and scope.

## Resolution and overrides

Project paths resolve from the directory containing the selected config file.
The conventional config file is in the project root. A custom config file may
be selected inside the project root, including by absolute path. The custom
file path does not change the project security boundary. Pannonico resolves an
existing config file physically and rejects a symlink chain that redirects the
read outside the project root.

Build flag values override config values. Config values override built-in
defaults. The same normalized override contract applies to CLI and embedded
product invocations.

The supported override fields are pages, layouts, partials, data, output,
default layout, default language, and HTML validation. Edition, capability,
CSS inlining, watch, server, beautification, minification, and parallelism
settings are not project config. `--max-output-workers` is an invocation-only
publication cap and is never persisted in `pannonico.yaml`.

## Path rules

Configured paths and project-confined CLI path overrides must be relative. Pannonico treats `/`
and `\` as separators while validating configuration, independent of the host
operating system. It rejects:

- POSIX absolute paths;
- Windows drive and UNC paths;
- any `..` segment;
- paths outside the project root;
- an output path equal to a filesystem root;
- output inside a source root;
- a source root inside output;
- equal or nested source roots;
- overlaps that differ only by case.

A marked child project adds another path boundary. A parent source root may
contain the child because discovery prunes it, but a configured config file,
source root, languages file, or invocation `--data` root may not be equal to or
inside the child. Parent output may neither contain nor be contained by a child
root. These unsafe relationships report `PATH_CHILD_PROJECT_OVERLAP` before
remote data, Vite commands, rendering, or publication begins.

Vite output must be a dedicated directory below `vite.root`, remain separate
from every Pannonico source and final output, and contain the manifest. Vite
entry and resource source keys and manifest paths use normalized forward
slashes.

Configuration resolution is lexical. Source discovery checks existence, file
types, and symlinks before build output is planned.

`--data` is the one external-path exception: it replaces `paths.data`, accepts
an absolute native path, and resolves a relative value from the invocation
working directory. `paths.data` remains project-relative. An explicit `.`
output is accepted only by the generated-only ad hoc no-clobber policy; Vite
and structured projects still require a separate output directory. See
[`minimal-builds-and-data.md`](../build-and-output/minimal-builds-and-data.md).

`data.urls` is edition-neutral schema so one config parses consistently. Only
native Pro can load it. Free and WASI return `CAPABILITY_UNSUPPORTED` before
other build work. Repeated native Pro `--data-url` flags replace the list.
