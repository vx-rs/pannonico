# Sitemap generation

Pannonico generates one deterministic `sitemap.xml` at the site output root.
The feature is available in Free and Pro, native and WASI, and uses the same
rendered-page identities on every target.

## Configuration

The current 0.x configuration uses version 1:

```yaml
version: 1

site:
  url: https://example.com/products/docs/

sitemap:
  enabled: true
```

`sitemap.enabled` defaults to `true`, so the explicit setting above is
optional. `site.url` must be an absolute credential-free HTTP or HTTPS URL. It
may include a clean path prefix, but it cannot contain a query or fragment.
Pannonico normalizes away a trailing slash; the example base becomes
`https://example.com/products/docs`.

An invalid authored URL is a configuration error. When the sitemap is enabled
and `site.url` is absent, the build publishes the rest of the site, omits
`sitemap.xml`, and emits the non-fatal `SITEMAP_SITE_URL_MISSING` warning. To
use Pannonico without a sitemap, opt out explicitly:

```yaml
version: 1

sitemap:
  enabled: false
```

Explicit disablement requires no `site.url` and emits no missing-URL warning.

## Included routes

Only successfully rendered pages enter the sitemap. Copied files, page JSON,
Vite assets, `robots.txt`, and other pass-through output do not. Public routes
come from the page output identity:

| Output path               | Public route         |
|---------------------------|----------------------|
| `index.html`              | `/`                  |
| `guides/index.html`       | `/guides/`           |
| `guides/setup/index.html` | `/guides/setup/`     |
| `about.html`              | `/about.html`        |
| `news/archive.html`       | `/news/archive.html` |

The configured base path prefix is preserved when a route is joined. Pannonico
does not infer clean URLs for ordinary `.html` pages.

Exclude one page with reserved page frontmatter:

```yaml
---
title: Private landing page
pannonico:
  sitemap:
    exclude: true
---
```

Exclusion affects only sitemap membership. Pannonico still renders, validates,
and publishes the page. The reserved `pannonico` control object is removed from
ordinary `.page` data; sidecar data named `pannonico` remains ordinary content.

The Sitemap protocol requires at least one URL. If every rendered page is
excluded, preflight fails with `SITEMAP_ROUTE_INVALID` and no output tree is
published. Set `sitemap.enabled: false` when a site intentionally has no
sitemap routes.

## Output contract

Pannonico sorts absolute locations lexically, XML-escapes their content, and
writes fixed indented XML with an XML declaration and trailing newline. URL
construction uses URL path fields, so Unicode and URL-sensitive route names
receive URL escaping before XML escaping. Free, Pro, serial, parallel, native,
and WASI builds therefore produce the same sitemap bytes for the same routes.

The single-file protocol limits are 50,000 included URLs, fewer than 2,048
characters per absolute location, and at most 52,428,800 encoded XML bytes.
Exceeding a limit fails the build before output mutation. Sitemap indexes are
not generated.

`sitemap.xml` participates in the combined output collision plan before
template execution. A page, copied file, or Vite artifact targeting that path
causes a collision error rather than overwriting either owner. Publication is
atomic with the rest of the site.

## Dry runs, reports, and inspection

A valid dry run creates the complete XML bytes in memory, reports one planned
generated file, and writes no site output. `--dry-run --verbose` prints whether
the sitemap is planned, disabled, missing a base URL, or blocked by a failed
build, followed by its base URL, route counts, and output when available.

JSON report schema 1 contains `wouldGenerateFiles`, `filesGenerated`, and the
complete `sitemap` object. Its `reason` is one of
`configuration_unresolved`, `disabled`, `site_url_missing`, `dry_run`,
`build_failed`, or the empty string after successful publication. A committed
build maintains:

```text
filesWritten = pagesBuilt + filesCopied + filesGenerated
```

MCP `inspect_project` exposes resolved sitemap policy and page public routes;
`validate_project` and `build` return the same complete schema-1 report as the
CLI.

Pannonico currently generates no sitemap index, `lastmod`, `changefreq`,
`priority`, image/video/news entries, `robots.txt`, or search-engine submission.
