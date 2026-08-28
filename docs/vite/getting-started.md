# Getting started with Vite

This guide adds Vite-managed frontend assets to a Pannonico site. It starts
with plain CSS and JavaScript, then switches to SCSS and TypeScript. The final
section adds Vue as an optional client-side layer.

Pannonico continues to render HTML, Markdown, Go templates, layouts, and data.
Vite builds the frontend module graph. Pannonico reads Vite's manifest and
provides the resolved asset URLs to your templates.

For the full configuration and compatibility contract, read
[`vite-integration.md`](integration.md). The steps below produce the complete
TypeScript and SCSS project without requiring a separate example checkout.

## Fast path

Create the complete locked TypeScript and SCSS starter:

```sh
pannonico scaffold --vite my-site
cd my-site
```

Pannonico selects the generated configuration from the running binary:

- Free native creates managed production build configuration.
- Pro native also creates coordinated Vite configuration for Integrated
  development mode through `pannonico watch`.
- Free and Pro WASI create process-free configuration for host-built assets.

Read the generated `README.md` and run its first commands. Scaffolding does not
install npm dependencies or start Vite. Continue with the manual steps below
when you want to add Vite to an existing site or understand every file.

## Prerequisites

Install these tools before you start:

- a native Pannonico binary or WASI-capable Pannonico launcher;
- Node.js and npm;
- the native Pro binary if you want Integrated development mode through
  `pannonico watch`, whether Pannonico starts Vite or waits for an external
  Vite server.

The production build works in Free and Pro. `pannonico watch` starts Integrated
development mode, a native Pro capability. WASI can consume built Vite output
but cannot start Node.js or Vite.

The commands below run from the Pannonico site root unless a step changes the
working directory.

## 1. Create or open a Pannonico site

Create a site if you do not already have one:

```sh
pannonico scaffold my-site
cd my-site
```

The site uses the standard `pages/`, `layouts/`, `partials/`, `data/`, and
`dist/` directories. Keep frontend source in a separate `frontend/` directory.

The final directory structure will start like this:

```text
my-site/
  frontend/
    src/
  layouts/
    default.html
  pages/
    index.html
    styles/
      site.css
  partials/
    vite.html
  package.json
  package-lock.json
  pannonico.yaml
  tsconfig.json
  vite.config.js
```

## 2. Create the frontend package

Create the frontend directory and install Vite:

```sh
mkdir -p frontend/src
npm init --yes
npm install --save-dev vite@8
```

The site accepts Vite 8 releases. Vite `8.2.2` is the current concrete release
covered by the repository's locked real-build fixture. Check the compatibility
table in [`vite-integration.md`](integration.md) before changing the major.

Set `private` and `type`, then add the Vite scripts in
`package.json`. Merge these fields into the generated file. Preserve
the `devDependencies` entry that npm created for Vite:

```json
{
  "name": "my-site-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "assets:build": "vite build",
    "assets:dev": "vite --host 127.0.0.1 --port 5173 --strictPort"
  }
}
```

Commit `package-lock.json`. The site owns and locks its Vite version.
Pannonico selects a supported manifest format from the manifest content, not
from the installed Vite version.

## 3. Define the Vite input

Create `vite.config.js` at the project root:

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
        app: 'frontend/src/app.js',
      },
    },
  },
})
```

This configuration gives Vite one input named `app`. Vite writes its output to
`frontend/.pannonico/vite` and its backend manifest to
`frontend/.pannonico/vite/.vite/manifest.json`.

Do not configure Vite to write directly to Pannonico's `dist/` directory.
Pannonico publishes the rendered site and Vite output together.

## 4. Add plain CSS and JavaScript

First add an ordinary stylesheet outside the Vite graph. Create
`pages/styles/site.css`:

```css
body {
  font-family: system-ui, sans-serif;
  margin: 2rem;
}
```

Pannonico will copy this file without transforming it.

Create `frontend/src/app.css`:

```css
#app {
  border-inline-start: 0.25rem solid #2563eb;
  padding-inline-start: 1rem;
}
```

Create `frontend/src/app.js`:

```js
import 'vite/modulepreload-polyfill'
import './app.css'

const app = document.querySelector('#app')

if (app) {
  app.textContent = 'Vite JavaScript loaded.'
}
```

Importing the stylesheet makes it part of Vite's module graph. A production
build can give it a content-hashed filename. Vite serves the same import from
memory during development.

## 5. Configure Pannonico

Create `pannonico.yaml`:

```yaml
version: 1

vite:
  root: .
  output: frontend/.pannonico/vite
  manifest: .vite/manifest.json
  entries:
    app: frontend/src/app.js
  buildCommand:
    executable: npm
    arguments: [run, assets:build]
  devCommand:
    executable: node
    arguments: [node_modules/vite/bin/vite.js, --host, 127.0.0.1, --port, "5173"]
  devServer: http://127.0.0.1:5173
```

This selects the project root as the command root while keeping frontend source
and generated output below `frontend/`. It retains the defaults
`vite.manifestFormat: auto` and `vite.publicPath: /`.

The two `app` names have different roles:

- `rolldownOptions.input.app` defines the Vite input.
- `vite.entries.app` defines the stable alias used by Go templates.

The Pannonico alias maps to `frontend/src/app.js`, which must match the source key in
Vite's generated manifest. Defining `entries.app` does not create a Vite input.

Pannonico runs each configured command in `vite.root`, which is the project
root in this example. It passes `arguments` literally and does not invoke a shell.

Run the project-local Vite entrypoint directly so Pannonico owns the actual
long-running process on POSIX and Windows:

```yaml
buildCommand:
  executable: pnpm
  arguments: [vite, build]
devCommand:
  executable: node
  arguments: [node_modules/vite/bin/vite.js, --host, 127.0.0.1, --port, "5173"]
```

Use the package manager that owns the site's lockfile for installation and
finite production builds. Do not place a package-manager wrapper or `.cmd` shim
in a managed `devCommand`; Pannonico can guarantee shutdown only for the process
it starts. To run `npm run assets:dev`, omit `devCommand` and manage Vite
externally.

## 6. Render the Vite tags

Create `partials/vite.html`:

```html
{{if has .pannonico "vite"}}
  {{with .pannonico.vite}}
    {{if .client}}<script type="module" src="{{.client}}"></script>{{end}}
    {{with get .entries "app"}}
      {{range .css}}<link rel="stylesheet" href="{{.}}">{{end}}
      <script type="module" src="{{.file}}"></script>
      {{range .modulePreload}}<link rel="modulepreload" href="{{.}}">{{end}}
    {{end}}
  {{end}}
{{end}}
```

Edit the existing `layouts/default.html`. Keep its current language, classes,
partials, and page content. Add the ordinary stylesheet and Vite partial inside
the document `<head>`:

```html
<link rel="stylesheet" href="/styles/site.css">
{{template "vite" .}}
```

Add a frontend mount element before the closing `</body>` tag:

```html
<div id="app" aria-live="polite"></div>
```

The ordinary `/styles/site.css` link and the Vite-managed stylesheet use
different pipelines:

- `pages/styles/site.css` is a static Pannonico source file. Pannonico copies
  it without transformation.
- `frontend/src/app.css` is imported by `app.js`. Vite processes it and records
  the generated URL in the manifest.

Both stylesheets can appear on the same page. The Vite partial works for HTML
and Markdown pages that use this layout.

## 7. Run a production build

Run Pannonico from the site root:

```sh
pannonico build .
```

Pannonico performs these actions in order:

1. It runs `npm run assets:build` in the project root.
2. It validates the generated Vite manifest and output tree.
3. It renders the Pannonico pages.
4. It publishes the pages and Vite assets together in `dist/`.

Open `dist/index.html`. The Vite partial should contain hashed production URLs
for the module and its extracted stylesheet. The ordinary stylesheet remains
`/styles/site.css`.

If the manifest uses an unsupported schema, the build stops before replacing
the existing output. The diagnostic identifies the manifest problem. When
reporting it through the support channel that supplied Pannonico, include a
sanitized reproduction.

## 8. Switch to SCSS and TypeScript

Install the SCSS compiler and TypeScript in the root package:

```sh
npm install --save-dev sass@1 typescript@7
```

Rename `frontend/src/app.css` to `frontend/src/app.scss`. SCSS syntax can now be
used in that file:

```scss
$accent: #6d28d9;

#app {
  border-inline-start: 0.25rem solid $accent;
  padding-inline-start: 1rem;
}
```

Rename `frontend/src/app.js` to `frontend/src/app.ts` and update its stylesheet
import:

```ts
import 'vite/modulepreload-polyfill'
import './app.scss'

const app = document.querySelector<HTMLElement>('#app')

if (app) {
  app.textContent = 'Vite TypeScript and SCSS loaded.'
}
```

Change the Vite input in `vite.config.js`:

```js
rolldownOptions: {
  input: {
    app: 'frontend/src/app.ts',
  },
},
```

Change the Pannonico source mapping in `pannonico.yaml`:

```yaml
entries:
  app: frontend/src/app.ts
```

The template still reads `.pannonico.vite.entries.app`. Only the source key
behind that stable alias changed.

Vite transpiles TypeScript but does not type-check it. Add a `tsconfig.json` and
a separate `tsc --noEmit` script when the site needs static type checking. The
generated Pannonico Vite scaffold names this script `typecheck`, so its three
frontend convenience commands are:

| npm command                              | Underlying command                               | Use                                            |
|------------------------------------------|--------------------------------------------------|------------------------------------------------|
| `npm run assets:build` | `vite build`                                     | Write the production Vite output and manifest. |
| `npm run assets:dev`   | `vite --host 127.0.0.1 --port 5173 --strictPort` | Start the fixed local development server.      |
| `npm run typecheck`    | `tsc --noEmit`                                   | Check TypeScript without writing JavaScript.   |

Run another production build:

```sh
pannonico build .
```

The Pannonico workflow is unchanged. Vite now compiles the TypeScript and SCSS
before Pannonico reads the manifest.

## 9. Use Integrated development mode with Vite

Start Integrated development mode with native Pro from the site root:

```sh
pannonico watch .
```

Pannonico starts the configured `devCommand` once and waits for
`http://127.0.0.1:5173/@vite/client`. It then starts the Pannonico development
server. The same template partial emits Vite development URLs instead of
production manifest URLs.

Keep the port fixed across `devServer`, `devCommand`, and Vite `server.port`,
with `server.strictPort: true`. For a Vite base such as `/docs/`, set
`devServer` to `http://127.0.0.1:5173/docs`; keep `server.origin` equal to the
origin without `/docs`.

The two processes handle different changes:

- Vite handles CSS, SCSS, JavaScript, TypeScript, Vue, and imported assets. It
  sends asset updates through Vite HMR.
- Pannonico handles pages, layouts, partials, data, and configuration. It
  rebuilds the site and triggers a full-page reload.

Stopping `pannonico watch` also stops the Vite process that Pannonico started.

To manage Vite yourself, remove `devCommand` from `pannonico.yaml`. Keep
`devServer` configured and run the processes in separate terminals.

Terminal 1:

```sh
npm run assets:dev
```

Terminal 2:

```sh
pannonico watch .
```

Pannonico waits for the external Vite server but does not own or stop it.

## 10. Add Vue optionally

Complete the SCSS and TypeScript steps first. Install Vue and its Vite plugin:

```sh
npm install vue@3
npm install --save-dev @vitejs/plugin-vue@6
```

These major lines match the same locked compatibility fixture as Vite. The
site's package lock records the concrete versions tested together.

Enable the plugin in `vite.config.js`:

```js
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
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

Create `frontend/src/App.vue`:

```vue
<script setup lang="ts">
const title: string = 'Vue loaded through Vite'
</script>

<template>
  <section class="vite-app">
    <h2>{{ title }}</h2>
    <p>Pannonico rendered the page. Vue mounted this component.</p>
  </section>
</template>

<style scoped>
.vite-app {
  padding: 1rem;
}
</style>
```

Replace `frontend/src/app.ts` with this entry:

```ts
import 'vite/modulepreload-polyfill'
import { createApp } from 'vue'
import App from './App.vue'
import './app.scss'

const mount = document.querySelector('#app')

if (mount) {
  createApp(App).mount(mount)
}
```

No Pannonico configuration or template change is required. Vite owns the Vue
plugin and `.vue` files. Pannonico still sees the single `frontend/src/app.ts` manifest
entry through the stable `app` alias.

Use small mount elements for client-side islands when most of the page is
rendered by Pannonico. Mounting Vue on an element that already contains
Pannonico content replaces that element's contents.

Run `pannonico build .` for production or `pannonico watch .` for Vue HMR.
Install and configure `vue-tsc` separately if the site needs type checking for
Vue single-file components.

## 11. Use an external build or WASI

Remove `buildCommand` when another process or CI job builds the frontend. Build
Vite before Pannonico:

```sh
npm run assets:build
pannonico build .
```

Pannonico consumes the existing output and manifest when `buildCommand` is
absent. Clean `frontend/.pannonico/vite` before the external Vite build;
Pannonico does not delete externally prepared output and publishes every file
in that snapshot.

WASI always uses this external-build model. A WASI module cannot execute
Node.js, npm, pnpm, or Vite. Build the frontend on the host, then run the
Pannonico WASI module against the site. Keep
`frontend/.pannonico/vite/.vite/manifest.json` and every referenced Vite output
file available to the WASI filesystem mapping.

## Troubleshooting

### The manifest entry is missing

Compare these two values exactly:

```yaml
# pannonico.yaml
entries:
  app: frontend/src/app.ts
```

```js
// vite.config.js
input: {
  app: 'frontend/src/app.ts',
}
```

The Pannonico value maps the template alias to the manifest source key. The
alias name does not replace the source key.

### Watch cannot reach Vite

Confirm that `vite.devServer` matches Vite's protocol, host, port, and base
path. Set Vite's `server.origin` to the origin without the base path, use the
same fixed `server.port`, and enable `server.strictPort`. If an external process
owns Vite, start it before `pannonico watch .`.

### Dry run reports that Vite output is missing

`pannonico build --dry-run .` never runs `buildCommand`. Run the frontend build
first so the manifest and output tree already exist.

### TypeScript builds but type errors are not reported

Vite removes TypeScript syntax during its build. It does not run the TypeScript
type checker. Run `tsc --noEmit` as a separate package script or CI step.

### A new Vite release produces an unsupported manifest

Keep the site's lockfile on the last compatible Vite version. Read the
compatibility table in [`vite-integration.md`](integration.md). Provide a
sanitized manifest reproduction through the support channel that supplied
Pannonico.
