# Pannonico npm source

This public repository owns npm runtime TypeScript, the programmatic API,
launcher, package construction, tests, and npm documentation directly. Private
Go product source remains in pannonico-source. Do not project or synchronize
npm implementation from that repository.

Use strict NodeNext ESM TypeScript with .js import specifiers. Keep explicit
root API exports, labeled import groups, two-line sections, documented named
callables/public types, uppercase module constants, and behavior-oriented tests.
Run package-native format, lint, type, build, test, and installed-package checks.

The API runs this installed package's verified binaries. Preserve exact native
and bundled-WASI identity and the existing narrow fallback policy. Keep product
validation and capability policy in the binary. Do not publish private Pro bytes
or engine source. Generated binaries, dependencies, caches, and build output
are ignored; they are not committed.

Go manuals, legal/support files, and CLI changelog may still be projected into
their declared paths. README and documentation/ are owned here. Changes to API
source do not require a matching private implementation copy.
