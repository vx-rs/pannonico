# Example workflows

Create examples locally from the installed product so they do not depend on a
private source checkout.

## Minimal site

```text
pannonico scaffold minimal-site
pannonico build minimal-site
```

The generated project demonstrates the standard `pages/`, `layouts/`,
`partials/`, and `data/` ownership. Continue with the
[authoring guide](../authoring/README.md) to add data, Markdown, localization,
or navigation.

## Vite-backed site

```text
pannonico scaffold --vite vite-site
cd vite-site
```

Read the generated `README.md` before installing its pinned npm dependencies.
The scaffold selects native Free, native Pro, or WASI behavior from the
capabilities compiled into the running product. The
[Vite getting-started guide](../vite/getting-started.md) explains the files and
the managed, external, and process-free build paths.

## Handlebars migration

Use the [Handlebars migration guide](../installation-and-updates/migration-from-handlebars.md)
as a source-by-source conversion checklist. It includes the required layout,
partial, helper, frontmatter, data, localization, and Markdown replacements.
