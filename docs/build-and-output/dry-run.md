# Dry runs

`pannonico build --dry-run` runs the process-independent build pipeline without
changing site output.

## Pipeline

A dry run performs the currently implemented build stages:

1. load and validate configuration;
2. discover and classify sources;
3. load frontmatter and data namespaces;
4. plan and serialize an eligible sitemap in memory;
5. load and validate an existing Vite manifest/output snapshot when configured;
6. validate the combined page, copy, Vite, and generated-file output plan;
7. compile templates and validate dependencies;
8. resolve layouts, languages, and translation groups;
9. render every page when preflight has no errors;
10. validate rendered Pannonico directives, apply Pro CSS inlining or Free
   directive removal, then any optional HTML transformation;
11. audit that no actual directive remains and validate every successfully
   transformed page;
12. normalize the schema-v1 report;
13. write an explicitly requested JSON report.

All preflight stages run against immutable partial snapshots so independent
source problems can be collected. Rendering starts only when preflight has no
errors, which avoids secondary execution noise. If one page fails rendering,
other successful pages still receive HTML validation.
Directive diagnostics and output guarantees are identical between build and
dry run; see [`directives.md`](../authoring/directives.md).

## Output boundary

Dry runs do not inspect, create, replace, or remove the configured site output
directory. Rendered pages remain copied in-memory artifacts.
Dry run never executes `vite.buildCommand` or starts a Vite development server.
It fails with a Vite manifest diagnostic when no external snapshot exists.
When Pro CSS inlining selects Vite CSS, the existing snapshot must therefore be
built on the host before the dry run.

`--verbose` prints the effective route for every source considered during
discovery. Each row includes `pannonico`, `copy`, `vite`, or `exclude`, an
intended image action (`optimize`, `copy`, `skip`, or `-`), and `default` or the
matching `.pannonico` line. This view does not read skipped file contents or
run image compression; size and metadata fallback decisions occur only during
a real publication.

Verbose output also reports the sitemap as planned, disabled, skipped for a
missing `site.url`, or blocked by a failed build. A planned sitemap includes
its normalized base URL, included/excluded route counts, and `sitemap.xml`
target. Dry run serializes its exact bytes but does not publish them.

An explicitly requested JSON report is the only dry-run filesystem mutation.
The writer:

- creates a regular report file or overwrites the same opened regular-file
  identity;
- refuses symlinks and non-regular targets;
- requires the parent directory to exist;
- does not create site or report directories;
- attempts the report after successful and failed pipelines.

If report writing fails, the returned in-memory report contains
`REPORT_WRITE_FAILED`. That diagnostic cannot be persisted to the same failed
target.

## Report semantics

Dry-run reports always set `dryRun` to true. `wouldBuildPages` and
`wouldCopyFiles` come from discovered page, pass-through, and snapshotted Vite
plans. `wouldGenerateFiles` is 1 when a complete sitemap is planned and 0 when
it is disabled, lacks `site.url`, or fails. `sitemap.reason` is `dry_run` for a
valid plan. `filesWritten`, `pagesBuilt`, `filesCopied`, and `filesGenerated`
remain zero because no site artifact is written.

Warnings, including `CSS_INLINING_IGNORED`, keep `success` true and exit `0`.
Build or validation errors set
`success` false and exit `1`; invalid configuration exits `2`. Diagnostics are
written to standard error while live phase progress remains on standard
output. A dry run reports phases as they start but emits no publication,
directory, or artifact lines because it never writes the site tree.

`durationMs` measures the pipeline before report-file I/O and may vary between
runs. Diagnostics, paths, counts, and other semantic fields remain
deterministic.
