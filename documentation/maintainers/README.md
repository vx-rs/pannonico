# Node launcher maintainer documentation

1. [Development workflow](workflow/README.md)
2. [Testing](testing/README.md)
3. [Compilation and release](compilation-and-release/README.md)
4. [Integration fixture](examples/README.md)

Go owns product compilation and staged manifests. This project owns npm package
construction, installed-package selection, native process forwarding, the
confined WASI host, offline installation checks, and its internal Vite fixture.
