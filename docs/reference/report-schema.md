# JSON report schema v1

Pannonico returns the schema-1 build report from CLI and MCP builds and writes
it with `pannonico build --report-json`. Published 0.x schemas remain immutable
for their released version, while a later 0.x release may make a breaking
change with matching documentation and migration notes. Strict cross-version
compatibility begins with 1.0.0. Report files use two-space-indented JSON with
a trailing newline and stable semantic field order.

```json
{
  "schemaVersion": 1,
  "success": true,
  "dryRun": true,
  "edition": "free",
  "version": "0.0.0-dev",
  "target": "linux-amd64",
  "filesWritten": 0,
  "wouldBuildPages": 24,
  "wouldCopyFiles": 18,
  "wouldGenerateFiles": 1,
  "pagesBuilt": 0,
  "filesCopied": 0,
  "filesGenerated": 0,
  "sitemap": {
    "enabled": true,
    "wouldGenerate": true,
    "generated": false,
    "output": "sitemap.xml",
    "baseUrl": "https://example.com/docs",
    "includedRoutes": 23,
    "excludedRoutes": 1,
    "reason": "dry_run"
  },
  "warningCount": 0,
  "errorCount": 0,
  "diagnostics": [],
  "durationMs": 126
}
```

All fields are present. `diagnostics` is an empty array when there are no
findings. Marshaling sorts diagnostics and derives `warningCount` and
`errorCount` from warning and error entries. Information diagnostics remain in
the array without changing either count or build success. `durationMs` may vary
between runs; paths and semantic arrays are deterministic.

`wouldBuildPages`, `wouldCopyFiles`, and `wouldGenerateFiles` describe the
complete validated plan. `pagesBuilt`, `filesCopied`, and `filesGenerated`
describe the promoted tree. `filesWritten` is their sum after a successful
commit:

```text
filesWritten = pagesBuilt + filesCopied + filesGenerated
```

A failure before promotion keeps all committed counters at zero while
retaining known planned counts. If the tree commits and the separate requested
report write fails, committed counters remain accurate even though
`REPORT_WRITE_FAILED` makes the returned report unsuccessful.

## Sitemap state

The `sitemap` object always exists. Its fields distinguish resolved policy,
planning, and publication:

| Reason                     | Meaning                                                                     |
|----------------------------|-----------------------------------------------------------------------------|
| `configuration_unresolved` | Configuration failed before sitemap policy could resolve.                   |
| `disabled`                 | `sitemap.enabled` is false.                                                 |
| `site_url_missing`         | Generation is enabled but `site.url` is absent.                             |
| `dry_run`                  | Complete valid sitemap bytes were planned without publication.              |
| `build_failed`             | An eligible sitemap was not published because planning or the build failed. |
| empty string               | The real build published the sitemap successfully.                          |

`wouldGenerate` is true only when validated bytes exist. A dry run then sets
`wouldGenerateFiles` to 1 and `generated` to false. A successful real build
also sets `generated` true and `filesGenerated` to 1. Disabled and missing-URL
states use zero generated-file counts. Route counts include every rendered
page classified as included or excluded when that information is available.

`report.WriteFile` creates or overwrites one explicitly requested regular
non-symlink file in an existing directory. It does not create parent
directories. A failed dry run still attempts this artifact; if writing fails,
the returned report contains `REPORT_WRITE_FAILED`. See
[`dry-run.md`](../build-and-output/dry-run.md) and [`sitemap.md`](../build-and-output/sitemap.md).
