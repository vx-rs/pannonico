# Site output

`pannonico build` runs the same in-memory pipeline as dry run, then publishes
one complete output tree.

No staging directory is created until configuration, discovery, content,
template, localization, rendering, optional Pro CSS/HTML transformation,
final-HTML validation, sitemap serialization, combined output-plan validation,
and pass-through reads have
completed without errors.

Before those side effects, configuration validates the output against every
direct child project. The final output may not contain a child root, live
inside one, or otherwise overlap it. `PATH_CHILD_PROJECT_OVERLAP` leaves the
existing output untouched and prevents staging, remote fetches, and managed
frontend commands.

## Complete output plan

Generated pages, ordinary copied files, Vite output artifacts, and generated
site files form one deterministic plan. `sitemap.xml` is currently the only
generated site-file kind. The Vite manifest is metadata and is not published.
Targets must be non-empty, clean slash-separated relative paths. The output
planner rejects:

- absolute paths, backslashes, NUL and control characters;
- empty, `.`, and `..` segments;
- Windows-invalid punctuation, trailing dots or spaces, and reserved device
  names such as `CON`, `NUL`, `COM1`, and `LPT1`;
- case-insensitive duplicate targets;
- a target that is both a file and an ancestor directory of another target;
- a copied source whose absolute and project-relative identities disagree.

These checks repeat discovery's logical collision gate at the final mutation
boundary. They finish before copied bytes are read and before staging exists.
A sitemap target collision with a page, ordinary copy, or Vite artifact is
therefore rejected before template execution or output mutation.

## Ad hoc no-clobber output

An explicit `.` output is available only for a selected page file or shallow
root scan containing generated pages and no copied or Vite artifacts. Every
final target must be absent. HTML cannot replace its source; Markdown may
create an absent sibling `.html` file.

This policy stages and verifies the complete generated set in a hidden
project directory, then installs each target with an exclusive filesystem
link. A race that creates a target causes failure without replacement. On a
later failure, rollback removes only files and empty directories whose
filesystem identities still belong to the invocation; replaced or ambiguous
entries are preserved and reported. Existing project entries are never
truncated, renamed, or deleted.

Because the project directory itself cannot be atomically replaced, several
additive files do not become visible as one transaction. Ordinary output
directories continue to use the complete-tree staging and atomic promotion
described below. See
[`minimal-builds-and-data.md`](minimal-builds-and-data.md) for destination
prompting and eligibility.

## Pass-through bytes

Every copied source is opened as an unchanged regular non-symlink file. Its
identity is checked before opening, against the opened handle, and again after
the read. Source reads perform no text decoding, newline conversion, or
permission copying. Explicit `copy` routes retain these exact bytes; ordinary
Pannonico-owned JPEG and PNG assets may enter the image transformation
described below.

Page JSON participates in two roles. Content preflight parses it and stores an
immutable copy of the source bytes. Output rereads the source safely and
requires those bytes to match before copying them unchanged. A JSON change
between content preflight and output publication therefore fails before
staging instead of rendering from one document and publishing another.

Pro always snapshots copied `.css` files for directive-selected inlining and
retains their pre-render bytes. Publication requires the safely reread bytes to
match before copying them unchanged. Consuming a selected link does not remove
the stylesheet or its assets from the complete plan. Free does not prepare this
CSS source index. The final page audit described in
[`directives.md`](../authoring/directives.md) prevents build-time attributes from entering
this publication plan.

Vite output uses the same expected-byte reread rule. A changed asset, symlink,
special file, unsafe portable name, or collision with a page or ordinary copy
fails before staging. Vite always writes to its intermediate output; it never
writes directly to the final Pannonico tree.

Default-on image optimization runs only after the output package safely
rereads a Pannonico-owned copied JPEG or PNG and verifies any preflight bytes.
The serial preparation step receives either strictly smaller same-format bytes
or the original bytes before staging starts. Explicit `copy` routes have no
transform. A transform diagnostic stops before any output mutation. After a
successful promotion, the build-owned serial metadata summary may add one
source-free information diagnostic to reports and MCP results. See
[`image-optimization.md`](image-optimization.md).

## Physical path checks and staging

The configured output must still resolve to its normalized identity inside a
real non-symlink project root. Every existing output ancestor is rechecked as
a real directory. Missing output-parent directories are created with `0755`
and removed from the bottom up if publication fails while they remain empty.

Staging uses an unpredictable sibling directory on the final output's
filesystem. This keeps the final rename on one filesystem. Staged directories
use `0755`; files use `0644`. Files are created exclusively, written fully,
synced, and closed.

Complete-tree publication creates the sorted set of staging directories before
it starts file writes. Native builds then use at most thirty-two artifact
workers per available Go execution thread, bounded further by artifact count.
Free and Pro use the same publication worker policy without an edition-specific
ceiling. A positive `--max-output-workers` value may lower either edition's pool
and cannot raise the thread-derived limit. The same bound applies while safely
rereading ordinary pass-through sources; copy transforms remain serial. Each
staging worker owns at most one open artifact and still performs the full
exclusive-create, write, sync, and close sequence. WASI and ad hoc no-clobber
publication remain serial.

The output plan keeps one result slot per sorted artifact. After the workers
finish, the coordinator reports successful file events in output-path order.
If a write fails, it stops scheduling new artifacts, waits for the bounded
in-flight writes, reports the first failure in output-path order, and emits no
events after that failed artifact. A write failure skips verification and
promotion and removes the private staging tree. Concurrent completion order
therefore cannot change final bytes, diagnostics, or progress order.

Verification requires those exact permission bits on native hosts that expose
POSIX permissions. Go's Windows filesystem API and Node's WASI preview1 host
expose only writable versus read-only behavior through file metadata. Windows
and `wasip1` verification therefore require the requested entries to remain
writable instead of comparing unavailable POSIX bits. Type, identity,
containment, exact-tree, byte, staging, promotion, and rollback checks are
unchanged.

Verification remains serial. It walks the complete staged tree and requires:

- exactly the planned files and implied directories, with no extra entries;
- regular non-symlink files and real non-symlink directories;
- the documented permissions and expected file size;
- byte-for-byte equality with every immutable planned artifact;
- at least one byte for each generated HTML artifact.

The verifier opens every staged file and compares the opened identity with
metadata from before and after the read. Promotion likewise requires the
staging path to retain the directory identity originally created by this
operation.

Semantic HTML validation already happened in memory. Staging verification is
the physical completeness check.

## Promotion and rollback

Promotion reserves the deterministic sibling directory `.dist.backup` for a
default `dist` output. The reservation serializes Pannonico promotion attempts
and prevents rename-over-existing assumptions.

When old output exists, it moves to `.dist.backup/previous`. Staging then moves
to `dist`. The backup is recursively removed only after the new tree reaches
the final path. Complete-tree replacement makes stale files disappear without
recursively emptying the live output directory.

If installing staging fails, `previous` moves back to `dist`. A failure during
that rollback emits `OUTPUT_ROLLBACK_FAILED` and retains the recoverable old
tree at `.dist.backup/previous`; it never deletes that recovery artifact.
Ordinary preflight, copy, staging, verification, and promotion failures leave
the old output at `dist`.

Recursive cleanup is limited to a current-operation, non-symlink sibling
directory with the expected staging or backup basename. It never targets the
project root, a configured source tree, or an unresolved broad path. Cleanup
failure is a warning: it may leave a named temporary directory, but it does not
reverse an already committed site or hide the primary build error.

## Build report counters

For a successful non-dry publication:

- `pagesBuilt` is the number of generated pages committed;
- `filesCopied` is the number of ordinary and Vite copied sources committed;
- `filesGenerated` is the number of generated site files committed;
- `filesWritten` is `pagesBuilt + filesCopied + filesGenerated`;
- `wouldBuildPages`, `wouldCopyFiles`, and `wouldGenerateFiles` retain planned counts;
- `dryRun` is `false`.

Failures before promotion keep committed counters at zero. If the site commits
and only a later explicit report write fails, the returned report has
`success: false` and `REPORT_WRITE_FAILED`, but committed counters remain
accurate. `OUTPUT_CLEANUP_FAILED` is a warning and does not make an otherwise
successful publication fail.
