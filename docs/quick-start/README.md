# Quick start

With an installed Pannonico executable, create and build a zero-configuration
site:

```text
pannonico scaffold --with-docs my-site
pannonico build my-site
```

Use `&&` when the next action should run only after the previous action
succeeds:

```text
pannonico scaffold --with-docs my-site && \
  pannonico build my-site
```

The default scaffold uses `pages/`, `layouts/`, `partials/`, `data/`, and
`dist/`. It does not require `pannonico.yaml`. `--with-docs` also writes the
version-matched manual to `my-site/documentation/`; omit it when the project
does not need a local copy.

Continue with:

1. [Configuration and authoring](../authoring/README.md)
2. [Build and output behavior](../build-and-output/README.md)
3. [Capabilities and editions](../capabilities/README.md)
4. [Vite getting started](../vite/getting-started.md), when the site needs a
   frontend asset pipeline
5. [Example workflows](../examples/README.md)
