# File routing

An optional `.pannonico` file at the project root assigns files in Pannonico's
configured source roots to one of four handling modes. It controls file
ownership only. General build settings remain in `pannonico.yaml`.

Projects without `.pannonico` keep the existing behavior. Every considered
source defaults to `pannonico`.

An existing `.pannonico/` directory is not a routing file and is ignored. This
preserves Vite configurations that place generated output below that directory.
Move or reconfigure that generated directory before adding a `.pannonico` file,
because a filesystem path cannot be both a file and a directory.

## Syntax

Each rule contains a lower-case action followed by a project-root-relative
glob:

```text
# Frontend sources inside pages are owned by Vite
vite pages/scripts/**

# Emit third-party assets unchanged
copy pages/assets/vendor/**

# Do not emit design sources
exclude pages/design/**

# Restore normal handling below a broader rule
pannonico pages/scripts/generated/**
```

Blank lines and lines whose first non-whitespace character is `#` are ignored.
Whitespace between the action and pattern is allowed. Inline comments are not
special and remain part of the pattern.

The valid actions are:

| Action      | Behavior                                                                                               |
|-------------|--------------------------------------------------------------------------------------------------------|
| `pannonico` | Use the normal root-specific Pannonico parser, transformer, or copied-asset path. This is the default. |
| `copy`      | Pannonico publishes original bytes unchanged. It does not parse, transform, or optimize the file.      |
| `vite`      | Pannonico does not publish the file. The project declares external Vite ownership.                     |
| `exclude`   | Omit the file from Pannonico processing and output.                                                    |

In explanatory notation, `copy = Pannonico publishes original bytes unchanged`
and `vite = Pannonico does not publish the file`. The equals sign is not routing
syntax; rules continue to use an action followed by a glob, as in the examples
above.

Default-on PNG/JPEG optimization is a normal `pannonico` transformation.
Explicit `copy` images remain byte-identical. See
[`image-optimization.md`](image-optimization.md).

Unknown actions, missing patterns, malformed globs, absolute patterns, and
patterns containing `.` or `..` path segments fail configuration loading. The
diagnostic identifies `.pannonico` and the one-based rule line.

## Matching

Rules are evaluated from top to bottom. The last matching rule wins:

```text
vite pages/assets/**
pannonico pages/assets/content/**
copy pages/assets/content/raw/**
```

The effective handling is:

```text
pages/assets/app/logo.svg          vite
pages/assets/content/photo.jpg     pannonico
pages/assets/content/raw/file.bin  copy
```

Patterns and matched identities always use `/`, including on Windows. Matching
is case-sensitive on every host and uses doublestar syntax:

- `*` matches within one path segment;
- `?` matches one non-separator character;
- `**` as a path component matches recursively;
- character classes such as `[a-z]` and alternatives such as `{png,jpg}` are
  supported.

A backslash escapes a doublestar metacharacter when it must be matched
literally. For example, `copy pages/images/photo\[old\].png` matches the
brackets in that exact filename.

Patterns match complete paths relative to the project root. For example,
`copy pages/assets/vendor/**` matches files below the conventional pages root.
`copy assets/vendor/**` does not match that path.

## Discovery scope

Routing does not create a project-wide filesystem crawler. Pannonico continues
to consider only its configured `pages`, `layouts`, `partials`, and project
`data` roots, plus its existing explicit-page and shallow root-page modes. A
rule for `vendor/**` has no effect when `vendor/` is outside those roots. Put
such assets below a source root, for example `pages/assets/vendor/`, or select
an existing source root through `pannonico.yaml`.

Built-in hidden and temporary-file ignores run before routing. A routing rule
cannot restore an entry that source discovery does not consider.

Within `pages`, copied files keep their established pages-relative output path.
An explicit `copy` rule in `layouts`, `partials`, or project `data` bypasses
that root's parser and emits the project-relative path. This strict-root use is
deliberate and should be narrow because it exposes a normally internal source
file in site output.

Pannonico does not verify that Vite consumes a `vite` file and does not include
the source in its output. The rule is an explicit external-ownership
declaration by the project.

## Dry-run inspection

Use a verbose dry run to inspect every considered source, its effective mode,
and its provenance:

```text
pannonico build --dry-run --verbose
```

The routing table uses `default` for unmatched files and `.pannonico:<line>`
for explicit matches. Vite and excluded sources appear in this table even
though they do not enter the build inventory. Ordinary build output stays
concise.

JSON report schema v1 does not add routing fields. Its existing
`wouldBuildPages` and `wouldCopyFiles` counters reflect the effective routed
candidate set.
