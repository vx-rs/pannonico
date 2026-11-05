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

## Signed Resources with Pro

Asset signing (Signed Resources) is experimental and requires further testing.

Create a disposable OpenSSH Ed25519 pair outside the site directory:

```text
ssh-keygen -t ed25519 -N '' -f ~/.config/pannonico/keys/example.com
```

Set `signing.enabled: true` and the two key paths in `pannonico.yaml`, then
add the conditional `.pannonico.integrityManifestURL` meta element to the
shared layout. Run `pannonico signing-dns` to see the TXT value and
`pannonico build` to produce the two site-root metadata files. The
[Signed Resources reference](../reference/signed-resources-v1.md) covers the
full byte format, subfolder paths, and DNSSEC trust boundary. Do not publish
the private key with the site.
