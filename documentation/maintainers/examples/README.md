# Vite demo

The [demo](../../../demo/README.md) exercises a real Pannonico/Vite site with
the installed private development Pro package. It consumes the same generated
npm package that end users import; it does not run the source launcher.

```sh
npm run demo:typecheck
npm run demo:assets
npm run demo:build
npm run demo:verify
```

Prepare the Pro package and installation first using the
[compilation](../compilation-and-release/README.md) and
[testing](../testing/README.md) instructions. The frontend runner resolves the
public maintainer's declared Vite dependency. No private Go source is imported.
