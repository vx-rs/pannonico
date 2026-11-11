# Installation

Pannonico requires Node.js 24 or newer. Install the CLI globally or locally:

```sh
npm install --global pannonico
pannonico --version
npm install --save-dev pannonico
```

The next release built from this source adds the
[programmatic API](../programmatic-api.md) to the local package. Existing
CLI-only releases do not expose those imports. Both interfaces use the same
verified native selection and bundled WASI fallback. Public distribution is
Free-only; private development Pro packages are not a public install channel.

Maintainers use the public source repository's
[workflow](../../maintainers/workflow/README.md) and
[package construction](../../maintainers/compilation-and-release/README.md).
They pass explicit binary manifests; no private source import or npm code
projection is required. Installation does not publish or update a release.
