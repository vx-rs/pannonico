# WASI runtime

Set `PANNONICO_FORCE_WASI=1` to select the portable artifact explicitly:

```text
PANNONICO_FORCE_WASI=1 npx pannonico build site
```

The launcher automatically falls back to its bundled WASI runtime only when the
native package is missing, the Node host platform and architecture are
unsupported, or the verified native executable cannot start with `EACCES`,
`EPERM`, `ENOENT`, or `ENOEXEC`. It verifies `runtime/pannonico.wasm` before
execution and reports one of these reasons on standard error:

- `native-package-unavailable`
- `native-executable-unusable`
- `unsupported-native-host`

The exact automatic-fallback line is:

```text
pannonico: using WASI fallback (reason=<reason>)
```

A malformed manifest, unsafe member path, symlink, non-file, size or checksum
mismatch, target mismatch, native failure after process start, nonzero native
exit, signal, or missing bundled WASI file is a hard error. Forced WASI is not
reported as an automatic fallback.

For a positional file, the host preopens its real parent and forwards the file
identity below `/project`. For a directory, it preopens that project at
`/project`. Absolute and relative path options must remain inside the one
preopen, including local `--data` inputs. The host recognizes `--data-url`
syntax, but both WASI editions reject native-only remote data. Native-only
commands return Pannonico exit status `4`.

The WASI host does not create a missing scaffold root. Create the directory
before a forced or automatic-fallback scaffold command:

```text
mkdir site
PANNONICO_FORCE_WASI=1 npx pannonico scaffold --min site
```

The host forwards only `SOURCE_DATE_EPOCH` and preserves standard streams and
exit status.

For the complete product-side WASI capability boundary, read
[Capabilities and editions](../../../docs/capabilities/README.md).
