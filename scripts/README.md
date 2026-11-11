# npm maintainer scripts

These TypeScript scripts own package construction, manifest/tarball validation,
offline installation, candidate acceptance, and the demo checks. Build them with
`npm run build`; executable ESM is emitted under `dist/tools/scripts`.

Product inputs are explicit final manifests, not inferred build directories.
The builder never rebuilds a Go input, and installed/candidate tests never
repair or repack a candidate. The package-native commands and
[maintainer documentation](../documentation/maintainers/README.md) are authoritative.
