# Changelog

## 0.3.0

- Made bounded native page rendering and `--jobs` shared Free and Pro
  behavior. Both editions now default to the smaller of sixteen workers and
  the host's logical CPU count. Native staged-file publication uses the same
  bounded worker policy in both editions, while both WASI products remain
  serial.
- Reduced native build allocation and filesystem work in quiet progress,
  rendering ownership, source validation, directive-free HTML processing, and
  staged-output verification without changing output bytes or atomic
  publication.

## 0.2.0

- Separated CLI, LSP, and VS Code release lifecycles and kept standalone binaries as
  GitHub Release assets rather than Git or Git LFS content.
- Added `pannonico manual --eject [root]` and
  `pannonico scaffold --with-docs [root]` for linked local documentation.
- Replaced raw terminal Markdown topics with command help and ejection
  guidance while retaining MCP documentation resources.
- Adopted the documented pre-1.0 compatibility and migration policy.

## 0.1.3

- Published the Pannonico Free npm launcher and six target-specific native npm
  packages with a verified WASI Preview 1 fallback.
