# Signed Resources v1

Asset signing (Signed Resources) is experimental and requires further testing.

Pannonico Pro can sign the files produced by one completed build. A verifier can compare the bytes it observes for the current page with this
manifest.
The signature authenticates the hash list relative to a trusted Ed25519 key. It
does not secure the server, prove that an older signed build is current, or
attest to changes made to the live DOM after loading.

## Output files

A signed site contains two files at its output root:

- `pannonico-integrity.json`: the manifest. It is written last and is not in its
  own `files` object.
- `pannonico-key.pub`: the normalized OpenSSH Ed25519 public key, written as
  `ssh-ed25519 <SSH-wire-base64>` followed by LF, without a comment. It is
  included in `files` like other resources.

Every generated or copied build resource is hashed after its final
transformation. The hash is the lowercase hexadecimal SHA-256 of its exact
published bytes. This includes HTML, scripts, styles, images, fonts, copied
files, Vite output, sitemap, and the fallback public key. Files outside the
current build plan and a requested JSON build report are not site resources.

The manifest has exactly these fields:

```json
{
  "version": 1,
  "hash": "sha256",
  "algorithm": "ed25519",
  "files": {
    "/index.html": "<64 lowercase hex digits>",
    "/pannonico-key.pub": "<64 lowercase hex digits>"
  },
  "signature": "<padded standard Base64 of 64 raw bytes>"
}
```

The signing payload is UTF-8 compact JSON with `version`, `hash`, `algorithm`,
and `files` in that order. It has no signature field, whitespace, BOM, or
trailing newline. The `files` keys are sorted in ascending ASCII order.
Pannonico signs those payload bytes once with Ed25519. The surrounding manifest
may have ordinary JSON whitespace; a verifier validates its values and
reconstructs the payload before checking the signature. Other versions,
algorithms, unknown or duplicate fields, malformed hashes or Base64, and
ambiguous paths are invalid.

Each file key is `/` plus its slash-separated output-relative path. Encode the
UTF-8 bytes of each filename segment with URI percent encoding: leave only
ASCII letters, digits, `-._~` unescaped, use uppercase hex digits, and keep
`/` as the segment separator. Case and Unicode code points are unchanged.
Empty, `.` and `..` segments, invalid UTF-8, encoded separators that alter
boundaries, and duplicate canonical identities are invalid. Query strings,
fragments, hosts, and the deployment mount are not part of a file key.

For a site served at `https://example.com/docs`, the manifest lives at
`/docs/pannonico-integrity.json`. Its `/assets/app.js` entry names
`/docs/assets/app.js`. The same manifest keys work when the site is served at
the origin root.

## Signed watch previews

The Pro watch server serves signed HTML unchanged. It does not inject the live
reload script into a tree containing `pannonico-integrity.json`, because that
would invalidate the observed HTML hash. Watch automatically rebuilds and
re-signs on every source change. Refresh signed preview pages manually after
a successful build. Unsigned previews
retain automatic reload.

## DNS key and local fallback

`pannonico signing-dns [--config PATH] [root]` prints one owner and TXT value:

```text
_pannonico.example.com. IN TXT "v=PAN1; alg=ed25519; key=<padded Base64 of 32 raw Ed25519 public-key bytes>"
```

The owner uses the hostname of `site.url`, preserving subdomains and ignoring
the port and path. Publish that record and enable DNSSEC for independently
authenticated verification. The helper prints text; it does not change DNS.
The value fits one DNS TXT character string. When parsing DNS, concatenate
chunks within one TXT record, never across records. Parse semicolon-separated
fields with surrounding ASCII spaces removed. Require each of `v=PAN1`,
`alg=ed25519`, and `key` exactly once. Unrelated TXT records are not keys;
malformed or conflicting Pannonico records are failures.

If a validating DNS resolver reports genuine absence of a Pannonico key, the
verifier may use `pannonico-key.pub` from the manifest directory. For
`localhost` and IP-address sites, the Firefox verifier skips DNS and uses that
same key directly. It still checks the manifest signature, the key file's hash,
and loaded resource hashes. The result can be yellow, never DNS-authenticated
green. The key is served by the site, not stored in the verifier.

Local-key verification shows consistency only: someone who can replace the
site may replace its key and manifest together. A present but unusable DNS key
on a named host must not trigger fallback. The manifest never names or selects
the trusted DNS key. The manifest and key fetches stay on the visited origin,
including its port, and in the selected manifest directory.

## Browser discovery

Templates may render the location hint in a shared layout:

```html
{{with .pannonico.integrityManifestURL}}
  <meta name="pannonico-integrity" content="{{.}}">
{{end}}
```

The field is an origin-relative URL that includes the `site.url` path when
signing is enabled, and null otherwise. For copied HTML that Pannonico does
not render, author the literal URL in that document. A verifier treats the
hint as an untrusted same-origin location and binds the manifest's directory
to the site root. If no hint exists, it tries `/pannonico-integrity.json` at
the origin root.

## Known-answer vector

The disposable 32-byte seed is `07` repeated 32 times. Its raw public key is
`6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=` in padded Base64. The
`/index.html` resource is the UTF-8 text `<p>Hello</p>`. The normalized
`pannonico-key.pub` resource is:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOpKbGPinFIKvvVQexMuxfmVR3auvr57kkIe6mkURtIs
```

That line ends with one LF. The exact signed payload is:

```json
{"version":1,"hash":"sha256","algorithm":"ed25519","files":{"/index.html":"d0a26d23e9d8e0538fd47e7bc502d26cf6c320e8daaec7c8521d4769530f5900","/pannonico-key.pub":"f8e90d7caf699a07b8aab56ff8604cad8e5b7506fb3eff6ca4b8184b29195e92"}}
```

Its padded Base64 Ed25519 signature is
`AraPCd0DeDvl9puh1KyZ7Hm6BVP8jtnibxdd9+1+AdQNvY64cZ34yCQ+XUMXxdEBB3ZC3ke56H59FtsU69OwAA==`.
The producer checks this fixture in its Go tests; Node's standard crypto
implementation independently verifies the public key, payload, and signature.
