# Vite integration

Pannonico can consume a Vite backend manifest without making Vite part of page
rendering. Pannonico renders HTML and Markdown through Go templates. Vite owns
TypeScript, JavaScript, CSS, SCSS, framework plugins, imported assets, and the
frontend module graph.

The integration is optional. Projects without a `vite` mapping do not need
Node.js, do not inspect a manifest, and retain their existing output.

Start with [`vite-getting-started.md`](getting-started.md) for a complete
CSS and JavaScript setup, the SCSS and TypeScript upgrade, native Pro
Integrated development mode,
external builds, WASI, and optional Vue. This document defines the detailed
configuration, runtime, and compatibility contract.

The [getting-started guide](getting-started.md) builds a complete configuration,
Vite input, shared HTML/Markdown layout, ordinary CSS, SCSS, TypeScript,
partial, and production/development tag policy from an installed scaffold.

## Ownership

Define build inputs in `vite.config.js`. Map those source keys to stable template
aliases in `pannonico.yaml`:

```js
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    origin: 'http://127.0.0.1:5173',
    cors: { origin: 'http://127.0.0.1:3000' },
  },
  build: {
    manifest: true,
    outDir: 'frontend/.pannonico/vite',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        app: 'frontend/src/app.ts',
      },
    },
  },
})
```

```yaml
version: 1

vite:
  root: .
  output: frontend/.pannonico/vite
  manifest: .vite/manifest.json
  manifestFormat: auto
  publicPath: /
  entries:
    app: frontend/src/app.ts
  resources:
    logo: frontend/src/logo.svg
  buildCommand:
    executable: npm
    arguments: [run, assets:build]
  devCommand:
    executable: node
    arguments: [node_modules/vite/bin/vite.js, --host, 127.0.0.1, --port, "5173"]
  devServer: http://127.0.0.1:5173
```

`entries.app` does not create a Vite entry. It names the exact manifest key or
`src` value produced for the Vite input `frontend/src/app.ts`.

### Routing sources inside Pannonico roots

The separate `frontend/` directory in the standard setup is outside
Pannonico's configured source roots, so it does not need routing rules. If a
project instead keeps Vite-managed sources inside `pages/` or another configured
source root, declare their ownership in a project-root `.pannonico` file:

```text
# Vite consumes these sources and publishes their compiled output
vite pages/scripts/**
vite pages/styles/vite/**

# Pannonico publishes third-party assets without transforming them
copy pages/assets/vendor/**
```

The `vite` action declares external ownership: Pannonico does not publish the
matching files or verify that Vite consumes them through its input or public
graph.
The `copy` action publishes matching vendor assets byte-identically, including
JPEG and PNG files that Pannonico would otherwise optimize. Rules match paths
relative to the project root, and the last matching rule wins. See
[`file-routing.md`](../build-and-output/file-routing.md) for the complete routing contract.

### Nested project boundary

Vite settings are local to the marked project that declares them. A parent's
resolved Vite root, intermediate output, and manifest may not overlap a marked
child root in either direction. Pannonico reports
`PATH_CHILD_PROJECT_OVERLAP` before starting a production or development Vite
process. This is a safety rejection, not an instruction to an external Vite
process; configure each child independently and keep its frontend paths within
its own root.

## Configuration

| Field | Meaning |
| --- | --- |
| `root` | Vite project and command working directory. Default: `frontend`. |
| `output` | Dedicated Vite output below `root`. Default: `.pannonico/vite`. |
| `manifest` | Manifest path below `output`. Default: `.vite/manifest.json`. |
| `manifestFormat` | `auto` or a stable Pannonico format ID. Default: `auto`. |
| `publicPath` | Production URL prefix. It may be root-relative or absolute HTTP(S). Default: `/`. |
| `entries` | Template aliases mapped to Vite source keys. At least one is required. |
| `resources` | Optional aliases mapped to exact manifest keys or `src` values. Each resolves to one emitted file URL. |
| `buildCommand` | Optional native production command. Omit it for externally built assets. |
| `devCommand` | Optional native Pro Integrated development mode command. Omit it for an external Vite server. |
| `devServer` | Exact HTTP(S) public base used by Integrated development mode and development URLs. It may include a clean path; an authored trailing `/` is accepted and normalized away. |

Commands use an executable and literal arguments. Pannonico does not split a
string, invoke a shell, expand variables or globs, read `package.json` scripts,
or install dependencies.

```yaml
# npm script
buildCommand:
  executable: npm
  arguments: [run, assets:build]

# Project-local Vite process owned directly by Pannonico
devCommand:
  executable: node
  arguments: [node_modules/vite/bin/vite.js, --host, 127.0.0.1, --port, "5173"]
```

Equivalent production command shapes remain literal arrays:

| Manager | `executable` | `arguments`           |
|---------|--------------|-----------------------|
| npm     | `npm`        | `[run, assets:build]` |
| pnpm    | `pnpm`       | `[exec, vite, build]` |
| Yarn    | `yarn`       | `[vite, build]`       |
| Bun     | `bun`        | `[run, assets:build]` |

Keep a path containing spaces in one YAML scalar. String shorthand such as
`devCommand: npm run assets:dev` is invalid because it has no portable argument
boundaries. Do not place npm, pnpm, Yarn, Bun, or a `.cmd` shim between
Pannonico and a managed development server. Pannonico stops the process it
starts; executing Vite's Node entrypoint directly makes that process the actual
server on POSIX and Windows. To use a package-manager command, omit
`devCommand`, start it externally, and keep `devServer` configured.

Use one fixed port in `devServer`, `devCommand`, and Vite `server.port`. Set
`server.strictPort: true`; automatic port fallback would let Pannonico poll a
different process at the configured address. `devServer` may include a Vite
base path such as `http://127.0.0.1:5173/docs`. In that case set Vite `base` to
`/docs/`. Keep `server.origin` origin-only (`http://127.0.0.1:5173`) and allow
the Pannonico server origin through Vite's explicit CORS configuration.
Keep official development servers on loopback. Do not replace the explicit
origin with `server.cors: true`, and do not use `server.allowedHosts: true`;
both broaden which web origins or hostnames can reach the development server.

## Template tags

Pannonico supplies data and leaves markup policy to the template:

```html
{{if has .pannonico "vite"}}
  {{with .pannonico.vite}}
    {{if .client}}<script type="module" src="{{.client}}"></script>{{end}}
    {{with get .entries "app"}}
      {{range .css}}<link rel="stylesheet" href="{{.}}">{{end}}
      <script type="module" src="{{.file}}"></script>
      {{range .modulePreload}}<link rel="modulepreload" href="{{.}}">{{end}}
    {{end}}
    {{with get .resources "logo"}}<link rel="icon" href="{{.file}}">{{end}}
  {{end}}
{{end}}
```

Authors retain control of CSP nonces, integrity, `crossorigin`, preload policy,
and page-specific entry selection. Pannonico does not return trusted HTML.

An ordinary Pannonico stylesheet remains independent:

```html
<link rel="stylesheet" href="/styles/site.css">
```

A Vite-owned stylesheet is imported from an entry:

```ts
import 'vite/modulepreload-polyfill'
import './app.scss'
```

Production resolves the alias to hashed manifest URLs. Development resolves it
to `devServer/frontend/src/app.ts`; Vite then serves SCSS, TypeScript, and imported assets.
The same layout and partial work for HTML and Markdown pages.

### Entry and resource aliases

Entries and resources have separate namespaces, so the same alias may exist in
both. An entry must resolve to a manifest record with `isEntry: true`. A
resource may resolve to an entry or non-entry record, but the record must name
one concrete file captured from `vite.output`. Templates read its URL from
`.pannonico.vite.resources.<alias>.file`. An absent resource record or file can
mean Vite inlined the source. Pannonico reports
`VITE_RESOURCE_INVALID` instead of inventing a URL.

Multiple script entries remain explicit template choices:

```yaml
vite:
  entries:
    app: frontend/src/app.ts
    admin: frontend/src/admin.ts
    theme: frontend/src/theme.scss
  resources:
    logo: frontend/src/logo.svg
```

```html
{{$alias := .page.viteEntry}}
{{with get .pannonico.vite.entries $alias}}
  {{range .css}}<link rel="stylesheet" href="{{.}}">{{end}}
  <script type="module" src="{{.file}}"></script>
  {{range .modulePreload}}<link rel="modulepreload" href="{{.}}">{{end}}
{{end}}
```

Use a separate policy for a stylesheet input because Pannonico does not infer
tag type from the filename:

```html
{{with get .pannonico.vite.entries "theme"}}
  <link rel="stylesheet" href="{{.file}}">
{{end}}
```

If several selected entries repeat the same CSS or preload URL, the template
that composes those entries owns cross-entry de-duplication. Files copied by
Vite `publicDir`, such as `/robots.txt`, already have stable public paths and do
not need a manifest resource alias.

### Pro production CSS inlining

A production template can explicitly select a manifest CSS artifact for Pro
generic static-document inlining. The directive is the only control:

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

Production snapshots expose exact artifact bytes through their public URLs.
The inliner rebases relative `url(...)` values against that public stylesheet
URL, while publication keeps the compiled CSS and referenced assets in the
site tree. Development snapshots do not expose immutable CSS bytes; leave the
development link unselected so Vite continues to provide CSS HMR. If Free renders
a directive-selected production link, it keeps the link, removes the directive,
and emits one non-fatal warning. See [`directives.md`](../authoring/directives.md) for the
shared syntax and [`css-inlining.md`](css-inlining.md) for selector, residual, safety, and
non-email limitations.

## Build modes

### Managed native build

If `buildCommand` exists, native `pannonico build` runs it once in `vite.root`.
Before starting the command, Pannonico requires `vite.root` to be a real
directory, rejects symlinked output ancestors, removes only the dedicated
`vite.output`, and recreates it empty. Pannonico then reads the manifest and
complete output tree, renders pages, checks collisions, safely rereads asset
bytes, and promotes one combined output tree. Vite must not write directly to
`paths.output`.

### External and WASI build

If `buildCommand` is absent, Pannonico consumes existing Vite output without
cleaning it. The external producer must start from a clean `vite.output` so
stale files are not published. WASI always consumes an existing manifest
because it cannot spawn Vite. When configuration contains `buildCommand`, a
non-dry-run WASI build emits one `VITE_COMMAND_SKIPPED_TARGET` warning and uses
that manifest. A missing or stale manifest remains an error. Run Vite on the
host before calling the WASI module through the launcher that supplied it:

```text
npm run assets:build
pannonico build /absolute/site
```

### Production base policy

Vite `base` and Pannonico `publicPath` are separate owners that must describe
the same publication location. Root (`/docs/`) and absolute CDN
(`https://cdn.example.test/site/`) values are supported directly. When Vite
uses `base: './'`, configure an explicit root-relative or absolute
`publicPath` for templates, such as `/relative/`; Pannonico does not preserve
page-relative `./` URLs because a nested page would resolve them differently.
Internal imports remain Vite-owned manifest and chunk data.

### Dry run

`pannonico build --dry-run` never executes `buildCommand`. It validates an
existing manifest and output snapshot and includes Vite files in
`wouldCopyFiles`. Build the assets first if the snapshot is absent.

### Pro Integrated development mode

Native Pro Integrated development mode starts `devCommand` once when
configured, or waits for an
external server. It polls `<devServer>/@vite/client` before the first site build.
Vite owns asset HMR. Pannonico watches only its config, pages, layouts, partials,
data, and a configured standalone languages file. Asset edits do not cause a
Pannonico rebuild. Content edits rebuild the site and trigger full-page reload.

When conventional `pages/` is absent, watch observes only immediate root
`.html`, `.md`, and `.markdown` candidates plus creation of `pages/`; it does
not descend into frontend directories. When Vite settings change in
`pannonico.yaml`, watch replaces the owned Vite session, refreshes development
URLs, and switches to the new Pannonico input roots before the next build.
SIGINT and SIGTERM cancel POSIX watch. Cancellation stops both servers and
waits for the direct Vite child; POSIX uses an interrupt grace period before
kill, while Windows kills the direct child.

## SCSS, TypeScript, Vue, and React

- Vite transpiles TypeScript but does not type-check it. Run `tsc --noEmit` as a
  separate script or CI step when type checking is required.
- Vite handles plain CSS, CSS modules, PostCSS, and imported assets. Install
  `sass` in the site project for SCSS.
- Install and configure `@vitejs/plugin-vue` for `.vue` single-file components.
- Install and configure a React plugin for JSX/TSX and Fast Refresh. Backend
  integration requires the React refresh preamble in the user template during
  development; Pannonico does not inject it.
- Non-HTML entry points should import `vite/modulepreload-polyfill` when the
  module-preload polyfill is enabled.
- Configure Vite `server.origin` and CORS for the Pannonico development origin.

For `@vitejs/plugin-react`, place the development-only preamble before the
React entry tag in the Pannonico layout:

```html
{{if eq .pannonico.vite.mode "development"}}
<script type="module">
  import RefreshRuntime from '{{.pannonico.vite.server}}/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
</script>
{{end}}
```

### Plugin compatibility classes

- Client-graph plugins are compatible when they transform JavaScript,
  TypeScript, JSX/TSX, Vue files, CSS, or imported assets and emit ordinary
  manifest records. Vue and React are covered by the locked fixture.
- Output plugins are compatible when their emitted files stay inside
  `vite.output`; `publicDir` and a custom emitted asset are covered by the
  locked fixture. Map a file as a resource only when Vite records it in the
  manifest.
- Backend-template plugins can require authored template work, such as the
  React refresh preamble, CSP attributes, or page-specific entry selection.
- Plugins that depend on Vite owning `index.html`, `transformIndexHtml`, HTML
  environment replacement, Vite middleware mode, or SSR do not apply to
  Pannonico-rendered HTML. Pannonico does not emulate those hooks.

Pannonico does not send HTML or Markdown through Vite, compile Go templates in
Vite, transform arbitrary backend files, or copy assets outside Vite's input and
public graph.

## Edition and runtime matrix

| Behavior                                                | Free native | Pro native | Free WASI   | Pro WASI    |
|---------------------------------------------------------|-------------|------------|-------------|-------------|
| Vite omitted; no Node or manifest work                  | Supported   | Supported  | Supported   | Supported   |
| Consume an externally built manifest                    | Supported   | Supported  | Supported   | Supported   |
| Run managed `buildCommand`                              | Supported   | Supported  | Unavailable | Unavailable |
| Production entries, resources, and complete output copy | Supported   | Supported  | Supported   | Supported   |
| Integrated development mode with coordinated Vite HMR   | Unavailable | Supported  | Unavailable | Unavailable |

WASI production must receive one clean host-built Vite output. Free and Pro
consume the same normalized manifest contract; edition choice does not change
entry or resource URLs.

## Manifest compatibility

Pannonico supports manifest formats, not individual Vite versions.

| Pannonico format  | Selection             | Status                                        | Latest tested Vite |
|-------------------|-----------------------|-----------------------------------------------|--------------------|
| `vite-backend-v1` | Automatic or explicit | Supported for the complete Pannonico 1.x line | `8.2.2`            |

Selection order is explicit `manifestFormat`, a recognized schema marker, then
structural detection. An unknown marker does not fall back. Automatic selection
continues only when exactly one adapter matches. Existing adapters and their
historical normalized output remain supported for the complete Pannonico major
line. A structurally indistinguishable future format must be selected explicitly
so an update cannot reinterpret an older site.

`pannonico build --verbose` reports the selected stable format and whether it
was selected explicitly, by marker, or structurally. This is diagnostic
metadata only; the schema-v1 JSON build report does not expose manifest-adapter
selection.

The site owns the Vite version in its package file and lockfile. Pannonico does
not use an installed Vite version to choose a parser. Pannonico updates its
latest-tested versions only after real TypeScript, SCSS, framework, dynamic
import, CSS, and imported-asset builds pass through both native and WASI
consumers. Asset filenames are manifest data and may contain new content hashes
after a frontend tool update; compare complete output from the same freshly
built manifest instead of asserting literal hash names.

If Pannonico rejects a new schema, the diagnostic states that output was not
replaced. Report it through the support channel that supplied Pannonico and
include the Pannonico version, target, exact locked Vite version, and a
sanitized manifest or minimal reproduction. Do not submit private paths, names,
URLs, or credentials.
