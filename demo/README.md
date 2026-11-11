# Pannonico npm Vite demo

This fixture uses the installed development Pro package for Rich Markdown,
CSS inlining, HTML beautification, and native watch. It is acceptance material,
not a claim that a public Pro package is available.

From the repository root, prepare the exact Pro package/install, then run:

```sh
npm run demo:typecheck
npm run demo:assets
npm run demo:build
npm run demo:verify
npm run demo:watch
```

Vite assets are built by the compiled `dist/tools/demo/run-vite.js` runner.
Pannonico consumes `.pannonico/vite/.vite/manifest.json` and the declared frontend
resources from `pannonico.yaml`. Development uses the same compiled runner for
the configured Vite child process. The installed CLI path is relative to this
public checkout's `.local/install/node/pro` workspace.

See the [product Vite manual](../docs/vite/README.md) and
[programmatic API](../documentation/user-manual/programmatic-api.md).
