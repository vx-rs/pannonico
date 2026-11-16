# Diagnostic codes

A diagnostic contains severity, stable code, message, source, one-based line
and column when known, related sources, notes, and help. JSON omits unavailable
locations. Core human rendering contains no timestamps or color. The CLI adds
ANSI severity color only for a terminal and disables it for `--no-color`,
`NO_COLOR`, `CI`, or `TERM=dumb`.

Diagnostics sort by normalized source path, line, column, severity, code, and
related-source key. Error sorts before warning, warning before info, and an
unknown severity last. Path comparison normalizes separators and compares a
case-folded key before the original spelling.
When every documented key is equal, message, note, and help text provide a
final deterministic tie-break without changing the primary ordering contract.

These are schema-1 identities under the pre-1.0 compatibility policy.
Published meanings are immutable for their released version. A breaking
change uses a new 0.x release with matching documentation and migration notes;
strict cross-version compatibility begins with 1.0.0.

## Saved workspace diagnostics

The Pannonico language server publishes definite reference failures for saved
HTML and Markdown sources whether or not those files are open. This includes a
partial when every reachable invocation explicitly forwards the unchanged
renderer root. A saved data or page change can therefore mark every affected
page, layout, or inferred partial at once:

```gotmpl
{{.data.company.team.lead}}
{{.nav.tree.c.company.p.team.data.lead}}
{{template "components/card" .}}
```

Removing the referenced local key or navigation page produces an Error with
`TEMPLATE_EXECUTION_FAILED` at the first missing direct-path segment. Removing
the literal partial produces `TEMPLATE_MISSING_PARTIAL` at its authored line.
Deleting a page's selected layout produces `LAYOUT_MISSING` on that page. The
server replaces and clears these findings after each relevant saved-file
reindex; unaffected closed files receive no empty notification.

An unsaved open template owns its direct-path diagnostics. Saved findings are
withheld while that template buffer differs from disk, then restored only after
saving that exact template completes a usable reindex. Saving a data file does
not mark an unrelated dirty template as synchronized. Partial data and
navigation paths remain ambiguous when any reachable call replaces dot, the
partial is unreferenced, or only unselected layouts reference it. Unknown paths
below configured remote data stay uncertain rather than becoming errors.

VS Code stores these closed-resource diagnostics in its normal Problems index.
With the built-in `problems.decorations.enabled` setting enabled (the default),
VS Code decorates affected files and their ancestor Explorer directories red.
Pannonico does not maintain a second decoration cache.

The table below lists the stable machine codes retained by JSON reports, MCP
results, and editor integrations. Human CLI headers translate these identities
to English labels, such as `ERROR Invalid command argument`, while preserving
the structured code for programmatic consumers.

- **Code**: `CLI_ARGUMENT_INVALID`; **Meaning**: Command syntax or a flag value is invalid.

- **Code**: `CLI_ENVIRONMENT_INVALID`; **Meaning**: A process input such as `SOURCE_DATE_EPOCH` is invalid.

- **Code**: `CAPABILITY_UNSUPPORTED`; **Meaning**: The selected command is unavailable in this compiled edition or target.

- **Code**: `MANUAL_FAILED`; **Meaning**: Manual ejection conflicts or could not be written safely.

- **Code**: `SCAFFOLD_FAILED`; **Meaning**: A scaffold target conflicts or could not be written safely.

- **Code**: `WATCH_FAILED`; **Meaning**: Native watching, serving, or browser opening failed.

- **Code**: `INTERNAL_ERROR`; **Meaning**: An unexpected panic reached the CLI containment boundary.

- **Code**: `CONFIG_READ_FAILED`; **Meaning**: The selected config file could not be read.

- **Code**: `CONFIG_INVALID_YAML`; **Meaning**: The config is malformed, has the wrong YAML shape, or contains multiple documents.

- **Code**: `CONFIG_UNKNOWN_FIELD`; **Meaning**: The config contains a field outside schema v1.

- **Code**: `CONFIG_DUPLICATE_KEY`; **Meaning**: A YAML mapping repeats a key.

- **Code**: `CONFIG_VERSION_REQUIRED`; **Meaning**: A present config has no schema version.

- **Code**: `CONFIG_VERSION_UNSUPPORTED`; **Meaning**: The config schema version is not `1`.

- **Code**: `CONFIG_INVALID_VALUE`; **Meaning**: A known field contains an unsupported or empty value.

- **Code**: `CONFIG_ROUTING_READ_FAILED`; **Meaning**: The optional `.pannonico` file could not be read as one stable regular file.

- **Code**: `CONFIG_ROUTING_MALFORMED_RULE`; **Meaning**: A `.pannonico` rule is incomplete or cannot be scanned safely.

- **Code**: `CONFIG_ROUTING_UNKNOWN_ACTION`; **Meaning**: A `.pannonico` rule uses an action other than `pannonico`, `copy`, `vite`, or `exclude`.

- **Code**: `CONFIG_ROUTING_INVALID_PATTERN`; **Meaning**: A `.pannonico` rule contains an unsafe or malformed project-relative glob.

- **Code**: `PATH_PROJECT_ROOT_INVALID`; **Meaning**: The selected project root is unavailable or is not a directory.

- **Code**: `PATH_CONFIG_OUTSIDE_ROOT`; **Meaning**: The selected config path is outside the project root.

- **Code**: `PATH_ABSOLUTE`; **Meaning**: A configured project path is absolute.

- **Code**: `PATH_ESCAPE`; **Meaning**: A configured project path contains `..` or escapes the root.

- **Code**: `PATH_SOURCE_OVERLAP`; **Meaning**: Two source roots are equal or nested.

- **Code**: `PATH_OUTPUT_OVERLAP`; **Meaning**: Output and a source root are equal or nested.

- **Code**: `PATH_OUTPUT_ROOT`; **Meaning**: Output is an unavailable project-root mode or a filesystem root.

- **Code**: `PATH_CHILD_PROJECT_OVERLAP`; **Meaning**: A selected input, output, or Vite path crosses a marked child-project boundary.

- **Code**: `DISCOVERY_ROOT_MISSING`; **Meaning**: A configured source root does not exist.

- **Code**: `DISCOVERY_ROOT_NOT_DIRECTORY`; **Meaning**: A configured source root is not a directory.

- **Code**: `DISCOVERY_READ_FAILED`; **Meaning**: Discovery could not inspect or walk a source path.

- **Code**: `DISCOVERY_SYMLINK`; **Meaning**: A source root component or discovered entry is a symlink.

- **Code**: `DISCOVERY_UNSUPPORTED_FILE_TYPE`; **Meaning**: A source entry is not a regular file or directory.

- **Code**: `DISCOVERY_UNEXPECTED_FILE`; **Meaning**: A strict layout, partial, or data root contains an unsupported regular file.

- **Code**: `DISCOVERY_PAGE_NOT_FOUND`; **Meaning**: No selected or fallback HTML/Markdown page exists.

- **Code**: `DISCOVERY_PAGE_TYPE_INVALID`; **Meaning**: An explicit page file has an unsupported type or suffix.

- **Code**: `COLLISION_SOURCE_PATH`; **Meaning**: Source paths collide after slash and case normalization.

- **Code**: `COLLISION_OUTPUT_PATH`; **Meaning**: Rendered or copied targets collide after slash and case normalization.

- **Code**: `COLLISION_PUBLIC_ROUTE`; **Meaning**: Rendered pages collide after public-route normalization.

- **Code**: `COLLISION_DATA_IDENTIFIER`; **Meaning**: Data sources collide in `.data`, `.page`, or `.local` after identifier normalization.

- **Code**: `COLLISION_TEMPLATE_NAME`; **Meaning**: Layout or partial names collide within their namespace after case normalization.

- **Code**: `COLLISION_NAVIGATION_KEY`; **Meaning**: Page siblings in one `p` collection or directory siblings in one `c` collection collide after NFC and Unicode case normalization.

- **Code**: `NAVIGATION_IDENTIFIER_INVALID`; **Meaning**: A navigation builder input is not one non-empty valid UTF-8 segment or contains NUL or a hierarchy separator. Valid punctuation and Unicode are encoded instead.

- **Code**: `SITEMAP_SITE_URL_MISSING`; **Meaning**: Sitemap generation is enabled but `site.url` is absent; page publication continues without a sitemap.

- **Code**: `SITEMAP_ROUTE_INVALID`; **Meaning**: A rendered page has no valid rooted clean public route, or no page remains included.

- **Code**: `SITEMAP_ROUTE_COLLISION`; **Meaning**: Sitemap routes collide after normalization.

- **Code**: `SITEMAP_URL_INVALID`; **Meaning**: A configured base and page route cannot form a safe absolute HTTP(S) location.

- **Code**: `SITEMAP_LIMIT_EXCEEDED`; **Meaning**: URL count, location length, or encoded XML size exceeds a single-file sitemap limit.

- **Code**: `SITEMAP_SERIALIZATION_FAILED`; **Meaning**: Valid sitemap locations could not be encoded as deterministic XML.

- **Code**: `DATA_READ_FAILED`; **Meaning**: A data source could not be revalidated or read safely.

- **Code**: `DATA_INVALID_JSON`; **Meaning**: A data source is not one valid JSON value.

- **Code**: `DATA_INVALID_YAML`; **Meaning**: A data source is not one valid YAML document.

- **Code**: `DATA_DUPLICATE_KEY`; **Meaning**: JSON or YAML data repeats an object key.

- **Code**: `DATA_UNSUPPORTED_VALUE`; **Meaning**: YAML data cannot be represented as a JSON-compatible value.

- **Code**: `DATA_NOT_OBJECT`; **Meaning**: A matching page sidecar is not an object.

- **Code**: `DATA_IDENTIFIER_INVALID`; **Meaning**: A global or local data path cannot form an identifier.

- **Code**: `DATA_MERGE_TYPE`; **Meaning**: Data authorities change an object, array, or scalar category incompatibly.

- **Code**: `DATA_SOURCE_ROOT_INVALID`; **Meaning**: An invocation data root is missing, linked, or not a stable directory.

- **Code**: `DATA_SOURCE_READ_FAILED`; **Meaning**: An invocation data document could not be inspected or read safely.

- **Code**: `DATA_SOURCE_SYMLINK`; **Meaning**: An invocation data directory contains a symlink.

- **Code**: `DATA_SOURCE_UNSUPPORTED_FILE`; **Meaning**: An invocation data file has an unsupported suffix.

- **Code**: `DATA_REMOTE_INVALID_URL`; **Meaning**: A Pro remote data URL or redirect violates the fixed HTTPS policy.

- **Code**: `DATA_REMOTE_TRANSPORT_FAILED`; **Meaning**: A Pro remote request failed or was canceled.

- **Code**: `DATA_REMOTE_STATUS_INVALID`; **Meaning**: A Pro remote request returned a non-2xx status.

- **Code**: `DATA_REMOTE_RESOURCE_LIMIT`; **Meaning**: A Pro remote URL count or response size exceeds a fixed limit.

- **Code**: `FRONTMATTER_READ_FAILED`; **Meaning**: A page or layout source could not be revalidated or read safely.

- **Code**: `FRONTMATTER_UNCLOSED`; **Meaning**: An opening frontmatter delimiter has no closing delimiter line.

- **Code**: `FRONTMATTER_INVALID_YAML`; **Meaning**: Frontmatter is not valid YAML.

- **Code**: `FRONTMATTER_DUPLICATE_KEY`; **Meaning**: Frontmatter repeats a YAML key.

- **Code**: `FRONTMATTER_UNSUPPORTED_VALUE`; **Meaning**: Frontmatter contains a YAML value with no JSON-compatible representation.

- **Code**: `FRONTMATTER_NOT_OBJECT`; **Meaning**: Frontmatter contains a non-object root value.

- **Code**: `FRONTMATTER_INVALID_CONTROL`; **Meaning**: A reserved page control has the wrong type or string form.

- **Code**: `TEMPLATE_READ_FAILED`; **Meaning**: A partial source could not be revalidated or read safely.

- **Code**: `TEMPLATE_NAME_INVALID`; **Meaning**: A layout or partial path cannot form a clean slash-qualified name.

- **Code**: `TEMPLATE_PARSE_ERROR`; **Meaning**: A page, layout, or partial is not valid Go template syntax.

- **Code**: `TEMPLATE_DEFINITION_UNSUPPORTED`; **Meaning**: A source uses `define` or `block` although Pannonico owns template names.

- **Code**: `TEMPLATE_MISSING_PARTIAL`; **Meaning**: A `template` action names no exact registered partial.

- **Code**: `TEMPLATE_RECURSION`; **Meaning**: The partial dependency graph contains a recursive chain.

- **Code**: `TEMPLATE_CONTEXT_INVALID`; **Meaning**: A page cannot form the required six-root rendering context.

- **Code**: `TEMPLATE_EXECUTION_FAILED`; **Meaning**: Strict map access, a helper, or Go template execution failed while rendering.

- **Code**: `LAYOUT_NAME_INVALID`; **Meaning**: A page selects a layout name that is not a clean slash-qualified name.

- **Code**: `LAYOUT_MISSING`; **Meaning**: A page's exact selected layout is not registered.

- **Code**: `MARKDOWN_RENDER_FAILED`; **Meaning**: A Markdown page or block could not be converted to HTML.

- **Code**: `MARKDOWN_DIRECTIVE_INVALID`; **Meaning**: Inline Markdown block directives are unmatched, unclosed, or nested.

- **Code**: `MARKDOWN_CONTAINER_NAME_INVALID`; **Meaning**: An enabled Pro container has a nonempty name that cannot form a safe CSS modifier; output falls back to the base container class.

- **Code**: `LANGUAGE_METADATA_READ_FAILED`; **Meaning**: The configured languages file could not be revalidated or read safely.

- **Code**: `LANGUAGE_METADATA_INVALID`; **Meaning**: The languages file has invalid YAML, shape, codes, fields, or values.

- **Code**: `LANGUAGE_INVALID`; **Meaning**: A selected page, layout, or configured language is invalid.

- **Code**: `LANGUAGE_REQUIRED`; **Meaning**: A translation group has no resolved language.

- **Code**: `TRANSLATION_GROUP_INVALID`; **Meaning**: A translation-group page has no valid output identity.

- **Code**: `TRANSLATION_LANGUAGE_DUPLICATE`; **Meaning**: One translation group contains multiple pages with the same canonical language.

- **Code**: `CSS_INLINING_IGNORED`; **Meaning**: Free preserved selected stylesheet behavior and removed recognized Pannonico directive attributes without inlining.

- **Code**: `CSS_STYLESHEET_READ_FAILED`; **Meaning**: A copied CSS source could not be safely revalidated or read for the immutable inlining index.

- **Code**: `CSS_INLINE_NODE_INVALID`; **Meaning**: A directive-selected style or link violates the explicit inlining-node contract.

- **Code**: `CSS_STYLESHEET_UNAVAILABLE`; **Meaning**: A selected local stylesheet is absent from the immutable copied/Vite source index.

- **Code**: `CSS_REMOTE_UNSUPPORTED`; **Meaning**: A selected stylesheet would require a network request.

- **Code**: `CSS_IMPORT_UNSUPPORTED`; **Meaning**: Selected CSS contains `@import`, which Pannonico does not load.

- **Code**: `CSS_PARSE_FAILED`; **Meaning**: Selected CSS or a matched element's existing inline declarations cannot be parsed safely.

- **Code**: `CSS_ENCODING_UNSUPPORTED`; **Meaning**: Selected CSS is not supported UTF-8 input.

- **Code**: `CSS_RESOURCE_LIMIT`; **Meaning**: Selected CSS or static selector matching exceeds a fixed safety limit.

- **Code**: `CSS_URL_UNSAFE`; **Meaning**: A stylesheet identity, page identity, or declaration URL cannot be resolved safely.

- **Code**: `CSS_HTML_REWRITE_FAILED`; **Meaning**: Pro selected CSS cannot be rewritten into authored HTML locally without ambiguity.

- **Code**: `IMAGE_OPTIMIZATION_FAILED`; **Meaning**: An enabled Pannonico-owned PNG/JPEG asset is malformed or its same-format encoder failed.

- **Code**: `IMAGE_METADATA_REMOVED`; **Meaning**: Build-level information listing the source-metadata categories removed from selected smaller JPEG/PNG replacements. It has no source path and is retained in reports and MCP results. Human build output prints its message and bullets without the severity/code header.

- **Code**: `HTML_OUTPUT_EMPTY`; **Meaning**: Final generated HTML contains only whitespace or no bytes.

- **Code**: `HTML_INVALID_UTF8`; **Meaning**: Final generated HTML is not valid UTF-8.

- **Code**: `HTML_NULL_CHARACTER`; **Meaning**: Final generated HTML contains a NUL character.

- **Code**: `HTML_PARSE_FAILED`; **Meaning**: The HTML tokenizer or parser could not consume final generated bytes.

- **Code**: `HTML_DOCTYPE_MISSING`; **Meaning**: An authored full document has no HTML doctype.

- **Code**: `HTML_TITLE_MISSING`; **Meaning**: An authored full document has no non-empty title.

- **Code**: `HTML_DUPLICATE_ID`; **Meaning**: A non-empty exact ID value occurs more than once in one document.

- **Code**: `HTML_TRANSFORM_FAILED`; **Meaning**: An enabled generated-HTML transform could not process one page.

- **Code**: `HTML_DIRECTIVE_UNKNOWN`; **Meaning**: An actual `pannonico-*` attribute is not an implemented directive.

- **Code**: `HTML_DIRECTIVE_INVALID`; **Meaning**: A known directive has invalid placement, duplication, or malformed start-tag syntax.

- **Code**: `HTML_DIRECTIVE_RENAMED`; **Meaning**: The removed `data-pannonico-inline-css` attribute must be replaced with `pannonico-inline-css`.

- **Code**: `HTML_DIRECTIVE_REWRITE_FAILED`; **Meaning**: A directive could not be removed safely, was not consumed by its command, or remained after formatting.

- **Code**: `REPORT_WRITE_FAILED`; **Meaning**: An explicitly requested JSON report could not be written safely.

- **Code**: `VITE_MANIFEST_READ_FAILED`; **Meaning**: The configured Vite manifest is absent or unreadable.

- **Code**: `VITE_MANIFEST_INVALID`; **Meaning**: A selected manifest has invalid records, graph references, or missing output.

- **Code**: `VITE_MANIFEST_FORMAT_UNSUPPORTED`; **Meaning**: No registered adapter supports the manifest or its schema marker.

- **Code**: `VITE_MANIFEST_FORMAT_AMBIGUOUS`; **Meaning**: Several automatic adapters match; set `vite.manifestFormat`.

- **Code**: `VITE_MANIFEST_FORMAT_MISMATCH`; **Meaning**: An explicit `manifestFormat` does not match the manifest.

- **Code**: `VITE_ENTRY_INVALID`; **Meaning**: A configured alias resolves to zero, several, or a non-entry record.

- **Code**: `VITE_RESOURCE_INVALID`; **Meaning**: A configured resource alias does not resolve to one emitted manifest file.

- **Code**: `VITE_ARTIFACT_UNSAFE`; **Meaning**: Vite output contains an unsafe path, symlink, type, or collision.

- **Code**: `VITE_COMMAND_FAILED`; **Meaning**: A configured native Vite build command failed.

- **Code**: `VITE_PROCESS_UNAVAILABLE`; **Meaning**: Vite process execution is absent from the target.

- **Code**: `VITE_DEV_SERVER_UNAVAILABLE`; **Meaning**: Watch could not start, refresh, or reach Vite.

- **Code**: `OUTPUT_PLAN_INVALID`; **Meaning**: A final generated or copied artifact has an incomplete, inconsistent, or non-portable identity.

- **Code**: `OUTPUT_COPY_READ_FAILED`; **Meaning**: A pass-through source could not be reread safely or changed after JSON preflight.

- **Code**: `OUTPUT_PATH_UNSAFE`; **Meaning**: The configured physical output or one of its ancestors is unsafe immediately before mutation.

- **Code**: `OUTPUT_TARGET_EXISTS`; **Meaning**: An additive target already exists and will not be replaced.

- **Code**: `OUTPUT_STAGING_CREATE_FAILED`; **Meaning**: A sibling staging directory could not be created or assigned safe metadata.

- **Code**: `OUTPUT_WRITE_FAILED`; **Meaning**: A planned artifact could not be written completely and synced in staging.

- **Code**: `OUTPUT_VERIFY_FAILED`; **Meaning**: The staged tree differs from the complete immutable plan.

- **Code**: `OUTPUT_PROMOTION_FAILED`; **Meaning**: Staging could not replace the final tree through the backup-first promotion sequence.

- **Code**: `OUTPUT_ROLLBACK_FAILED`; **Meaning**: Previous output could not be restored; `.dist.backup/previous` retains the recovery tree for default output.

- **Code**: `OUTPUT_CLEANUP_FAILED`; **Meaning**: An owned staging, backup, or newly created empty ancestor could not be removed safely.

WASI target limitations use `CAPABILITY_UNSUPPORTED` because the command is
known but absent from the effective target capability set. Node launcher
integrity and package-selection failures are launcher-owned errors rather than
Go build diagnostics.

Manifest-format failures state that the configured site output was not
replaced. Report a new schema through the support channel that supplied
Pannonico and provide only sanitized evidence. The diagnostic does not expose
local source, launcher, or artifact repository paths.
