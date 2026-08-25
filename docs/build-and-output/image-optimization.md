# Image optimization

Pannonico optimizes owned `.jpg`, `.jpeg`, and `.png` copied assets by default.
Extension matching is case-insensitive. The output path, filename, extension,
format, and pixel dimensions do not change.

Disable optimization for the complete project in `pannonico.yaml`:

```yaml
version: 1
images:
  optimize: false
```

There is no per-image quality setting. JPEG uses a fixed quality of 85 and PNG
uses lossless best compression from the Go standard library. Pannonico keeps
the original source bytes unless the encoded candidate is strictly smaller.
Already compressed and tiny files therefore commonly remain byte-identical.

## Routing interaction

Optimization applies only to copied assets whose effective `.pannonico` route
is `pannonico`, including the unmatched default. The other routes are exact:

- `copy` publishes the original bytes and never decodes the image;
- `vite` declares external ownership; Pannonico does not publish the file; and
- `exclude` emits nothing.

This works inside configured source roots. For example, users can keep
third-party images byte-identical with `copy pages/assets/vendor/**`.

## Metadata removal and fallback

Image optimization is also a privacy hardening boundary. A selected smaller
JPEG or PNG is re-encoded from decoded pixels and does not carry source
metadata into the web output. This removes EXIF fields such as GPS coordinates,
orientation, timestamps, thumbnails, and camera data, together with XMP,
comments, textual fields, application data, embedded color profiles, physical
pixel density, and color or HDR rendering metadata. For a recognized JPEG gain
map, Pannonico publishes the base SDR image and removes the gain map.

PNG encoding remains lossless for decoded color and alpha samples. JPEG keeps
its pixel dimensions and uses the documented fixed quality. Source color
profiles and rendering metadata are not applied to the replacement; decoded
samples are the authority. This favors small, metadata-free web assets over
preservation of source-device interpretation.

After successful publication, the schema-v1 report contains one source-free
`IMAGE_METADATA_REMOVED` information diagnostic when any selected replacement
removed metadata. Its bullet list contains the union of categories actually
removed across the build:

- embedded color profiles;
- physical pixel density;
- EXIF metadata, including orientation, GPS location, timestamps, thumbnails,
  and camera data;
- color and HDR rendering metadata;
- HDR gain maps, when base SDR images were used;
- comments, text, and timestamps;
- XMP and application data;
- embedded thumbnails; and
- other ancillary or trailing data.

The entry is build information, not a warning. It has no image paths, does not
increment `warningCount`, and is retained in JSON reports and MCP `build`
results. The human CLI omits the `INFO IMAGE_METADATA_REMOVED` machine header
but prints the explanatory sentence and category bullets. The ordinary artifact
rows identify optimized images and their before/after sizes.

Metadata removal occurs only when the smaller replacement is selected. To
preserve one image byte-for-byte and prevent its compression, add a `copy` rule
after broader matching rules in the project-root `.pannonico` file:

```text
copy pages/images/v-glow.jpg
```

Explicit `copy` routes, project-wide disabled optimization, candidates that are
not smaller, over-limit images, animated PNGs, isolated multipicture or ISO
gain-map JPEGs, non-square unitless pixel-aspect metadata, and CMYK JPEGs retain
their original bytes and metadata. Pannonico does not describe these fallbacks
as sanitized.

Each candidate is decoded serially during output preparation. Images above
33,554,432 pixels retain their original bytes, which bounds even a 16-bit
four-channel pixel buffer near 256 MiB and working memory to one image at a
time. Invalid supported images below that limit fail
with `IMAGE_OPTIMIZATION_FAILED`; replace the file or disable optimization.

## Dry runs and reports

Dry runs do not decode or compress image contents. A verbose dry run adds an
image-action column to routing rows: `optimize`, `copy`, `skip`, or `-` for a
non-image. These are intended actions; size and metadata fallback decisions
require the real publication-time source read.

JSON report schema v1 has no image-specific fields. Images remain copied-file
artifacts in `wouldCopyFiles`, `filesCopied`, and `filesWritten`. The single
build-level metadata-removal entry uses the existing `diagnostics` array with
`severity: "info"`; `warningCount` remains unchanged. Sitemap additions use
separate generated-file fields and do not change image accounting.

During a real non-quiet build, every image that becomes smaller shows its
before and after decimal sizes in the normal publication row, for example
`42.10 KB → 8.32 KB`. Safety, size-limit, and already-compressed fallbacks show
only the retained final size because no compression was published. Metadata
removal then appears once as explanatory prose and category bullets, without a
severity or diagnostic-code header. Quiet builds suppress that informational
block.
