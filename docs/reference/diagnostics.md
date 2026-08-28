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

| Code | Meaning |
| --- | --- |
| `CLI_ARGUMENT_INVALID` | Command syntax or a flag value is invalid. |
| `CLI_ENVIRONMENT_INVALID` | A process input such as `SOURCE_DATE_EPOCH` is invalid. |
| `CAPABILITY_UNSUPPORTED` | The selected command is unavailable in this compiled edition or target. |
| `MANUAL_FAILED` | Manual ejection conflicts or could not be written safely. |
| `SCAFFOLD_FAILED` | A scaffold target conflicts or could not be written safely. |
| `WATCH_FAILED` | Native watching, serving, or browser opening failed. |
| `INTERNAL_ERROR` | An unexpected panic reached the CLI containment boundary. |
| `CONFIG_READ_FAILED` | The selected config file could not be read. |
| `CONFIG_INVALID_YAML` | The config is malformed, has the wrong YAML shape, or contains multiple documents. |
| `CONFIG_UNKNOWN_FIELD` | The config contains a field outside schema v1. |
| `CONFIG_DUPLICATE_KEY` | A YAML mapping repeats a key. |
| `CONFIG_VERSION_REQUIRED` | A present config has no schema version. |
| `CONFIG_VERSION_UNSUPPORTED` | The config schema version is not `1`. |
| `CONFIG_INVALID_VALUE` | A known field contains an unsupported or empty value. |
| `CONFIG_ROUTING_READ_FAILED` | The optional `.pannonico` file could not be read as one stable regular file. |
| `CONFIG_ROUTING_MALFORMED_RULE` | A `.pannonico` rule is incomplete or cannot be scanned safely. |
| `CONFIG_ROUTING_UNKNOWN_ACTION` | A `.pannonico` rule uses an action other than `pannonico`, `copy`, `vite`, or `exclude`. |
| `CONFIG_ROUTING_INVALID_PATTERN` | A `.pannonico` rule contains an unsafe or malformed project-relative glob. |
| `PATH_PROJECT_ROOT_INVALID` | The selected project root is unavailable or is not a directory. |
| `PATH_CONFIG_OUTSIDE_ROOT` | The selected config path is outside the project root. |
| `PATH_ABSOLUTE` | A configured project path is absolute. |
| `PATH_ESCAPE` | A configured project path contains `..` or escapes the root. |
| `PATH_SOURCE_OVERLAP` | Two source roots are equal or nested. |
| `PATH_OUTPUT_OVERLAP` | Output and a source root are equal or nested. |
| `PATH_OUTPUT_ROOT` | Output is an unavailable project-root mode or a filesystem root. |
| `PATH_CHILD_PROJECT_OVERLAP` | A selected input, output, or Vite path crosses a marked child-project boundary. |
| `DISCOVERY_ROOT_MISSING` | A configured source root does not exist. |
| `DISCOVERY_ROOT_NOT_DIRECTORY` | A configured source root is not a directory. |
| `DISCOVERY_READ_FAILED` | Discovery could not inspect or walk a source path. |
| `DISCOVERY_SYMLINK` | A source root component or discovered entry is a symlink. |
| `DISCOVERY_UNSUPPORTED_FILE_TYPE` | A source entry is not a regular file or directory. |
| `DISCOVERY_UNEXPECTED_FILE` | A strict layout, partial, or data root contains an unsupported regular file. |
| `DISCOVERY_PAGE_NOT_FOUND` | No selected or fallback HTML/Markdown page exists. |
| `DISCOVERY_PAGE_TYPE_INVALID` | An explicit page file has an unsupported type or suffix. |
| `COLLISION_SOURCE_PATH` | Source paths collide after slash and case normalization. |
| `COLLISION_OUTPUT_PATH` | Rendered or copied targets collide after slash and case normalization. |
| `COLLISION_PUBLIC_ROUTE` | Rendered pages collide after public-route normalization. |
| `COLLISION_DATA_IDENTIFIER` | Data sources collide in `.data`, `.page`, or `.local` after identifier normalization. |
| `COLLISION_TEMPLATE_NAME` | Layout or partial names collide within their namespace after case normalization. |
| `COLLISION_NAVIGATION_KEY` | Page siblings in one `p` collection or directory siblings in one `c` collection collide after NFC and Unicode case normalization. |
| `NAVIGATION_IDENTIFIER_INVALID` | A navigation builder input is not one non-empty valid UTF-8 segment or contains NUL or a hierarchy separator. Valid punctuation and Unicode are encoded instead. |
| `SITEMAP_SITE_URL_MISSING` | Sitemap generation is enabled but `site.url` is absent; page publication continues without a sitemap. |
| `SITEMAP_ROUTE_INVALID` | A rendered page has no valid rooted clean public route, or no page remains included. |
| `SITEMAP_ROUTE_COLLISION` | Sitemap routes collide after normalization. |
| `SITEMAP_URL_INVALID` | A configured base and page route cannot form a safe absolute HTTP(S) location. |
| `SITEMAP_LIMIT_EXCEEDED` | URL count, location length, or encoded XML size exceeds a single-file sitemap limit. |
| `SITEMAP_SERIALIZATION_FAILED` | Valid sitemap locations could not be encoded as deterministic XML. |
| `DATA_READ_FAILED` | A data source could not be revalidated or read safely. |
| `DATA_INVALID_JSON` | A data source is not one valid JSON value. |
| `DATA_INVALID_YAML` | A data source is not one valid YAML document. |
| `DATA_DUPLICATE_KEY` | JSON or YAML data repeats an object key. |
| `DATA_UNSUPPORTED_VALUE` | YAML data cannot be represented as a JSON-compatible value. |
| `DATA_NOT_OBJECT` | A matching page sidecar is not an object. |
| `DATA_IDENTIFIER_INVALID` | A global or local data path cannot form an identifier. |
| `DATA_MERGE_TYPE` | Data authorities change an object, array, or scalar category incompatibly. |
| `DATA_SOURCE_ROOT_INVALID` | An invocation data root is missing, linked, or not a stable directory. |
| `DATA_SOURCE_READ_FAILED` | An invocation data document could not be inspected or read safely. |
| `DATA_SOURCE_SYMLINK` | An invocation data directory contains a symlink. |
| `DATA_SOURCE_UNSUPPORTED_FILE` | An invocation data file has an unsupported suffix. |
| `DATA_REMOTE_INVALID_URL` | A Pro remote data URL or redirect violates the fixed HTTPS policy. |
| `DATA_REMOTE_TRANSPORT_FAILED` | A Pro remote request failed or was canceled. |
| `DATA_REMOTE_STATUS_INVALID` | A Pro remote request returned a non-2xx status. |
| `DATA_REMOTE_RESOURCE_LIMIT` | A Pro remote URL count or response size exceeds a fixed limit. |
| `FRONTMATTER_READ_FAILED` | A page or layout source could not be revalidated or read safely. |
| `FRONTMATTER_UNCLOSED` | An opening frontmatter delimiter has no closing delimiter line. |
| `FRONTMATTER_INVALID_YAML` | Frontmatter is not valid YAML. |
| `FRONTMATTER_DUPLICATE_KEY` | Frontmatter repeats a YAML key. |
| `FRONTMATTER_UNSUPPORTED_VALUE` | Frontmatter contains a YAML value with no JSON-compatible representation. |
| `FRONTMATTER_NOT_OBJECT` | Frontmatter contains a non-object root value. |
| `FRONTMATTER_INVALID_CONTROL` | A reserved page control has the wrong type or string form. |
| `TEMPLATE_READ_FAILED` | A partial source could not be revalidated or read safely. |
| `TEMPLATE_NAME_INVALID` | A layout or partial path cannot form a clean slash-qualified name. |
| `TEMPLATE_PARSE_ERROR` | A page, layout, or partial is not valid Go template syntax. |
| `TEMPLATE_DEFINITION_UNSUPPORTED` | A source uses `define` or `block` although Pannonico owns template names. |
| `TEMPLATE_MISSING_PARTIAL` | A `template` action names no exact registered partial. |
| `TEMPLATE_RECURSION` | The partial dependency graph contains a recursive chain. |
| `TEMPLATE_CONTEXT_INVALID` | A page cannot form the required six-root rendering context. |
| `TEMPLATE_EXECUTION_FAILED` | Strict map access, a helper, or Go template execution failed while rendering. |
| `LAYOUT_NAME_INVALID` | A page selects a layout name that is not a clean slash-qualified name. |
| `LAYOUT_MISSING` | A page's exact selected layout is not registered. |
| `MARKDOWN_RENDER_FAILED` | A Markdown page or block could not be converted to HTML. |
| `MARKDOWN_DIRECTIVE_INVALID` | Inline Markdown block directives are unmatched, unclosed, or nested. |
| `MARKDOWN_CONTAINER_NAME_INVALID` | An enabled Pro container has a nonempty name that cannot form a safe CSS modifier; output falls back to the base container class. |
| `LANGUAGE_METADATA_READ_FAILED` | The configured languages file could not be revalidated or read safely. |
| `LANGUAGE_METADATA_INVALID` | The languages file has invalid YAML, shape, codes, fields, or values. |
| `LANGUAGE_INVALID` | A selected page, layout, or configured language is invalid. |
| `LANGUAGE_REQUIRED` | A translation group has no resolved language. |
| `TRANSLATION_GROUP_INVALID` | A translation-group page has no valid output identity. |
| `TRANSLATION_LANGUAGE_DUPLICATE` | One translation group contains multiple pages with the same canonical language. |
| `CSS_INLINING_IGNORED` | Free preserved selected stylesheet behavior and removed recognized Pannonico directive attributes without inlining. |
| `CSS_STYLESHEET_READ_FAILED` | A copied CSS source could not be safely revalidated or read for the immutable inlining index. |
| `CSS_INLINE_NODE_INVALID` | A directive-selected style or link violates the explicit inlining-node contract. |
| `CSS_STYLESHEET_UNAVAILABLE` | A selected local stylesheet is absent from the immutable copied/Vite source index. |
| `CSS_REMOTE_UNSUPPORTED` | A selected stylesheet would require a network request. |
| `CSS_IMPORT_UNSUPPORTED` | Selected CSS contains `@import`, which Pannonico does not load. |
| `CSS_PARSE_FAILED` | Selected CSS or a matched element's existing inline declarations cannot be parsed safely. |
| `CSS_ENCODING_UNSUPPORTED` | Selected CSS is not supported UTF-8 input. |
| `CSS_RESOURCE_LIMIT` | Selected CSS or static selector matching exceeds a fixed safety limit. |
| `CSS_URL_UNSAFE` | A stylesheet identity, page identity, or declaration URL cannot be resolved safely. |
| `CSS_HTML_REWRITE_FAILED` | Pro selected CSS cannot be rewritten into authored HTML locally without ambiguity. |
| `IMAGE_OPTIMIZATION_FAILED` | An enabled Pannonico-owned PNG/JPEG asset is malformed or its same-format encoder failed. |
| `IMAGE_METADATA_REMOVED` | Build-level information listing the source-metadata categories removed from selected smaller JPEG/PNG replacements. It has no source path and is retained in reports and MCP results. Human build output prints its message and bullets without the severity/code header. |
| `HTML_OUTPUT_EMPTY` | Final generated HTML contains only whitespace or no bytes. |
| `HTML_INVALID_UTF8` | Final generated HTML is not valid UTF-8. |
| `HTML_NULL_CHARACTER` | Final generated HTML contains a NUL character. |
| `HTML_PARSE_FAILED` | The HTML tokenizer or parser could not consume final generated bytes. |
| `HTML_DOCTYPE_MISSING` | An authored full document has no HTML doctype. |
| `HTML_TITLE_MISSING` | An authored full document has no non-empty title. |
| `HTML_DUPLICATE_ID` | A non-empty exact ID value occurs more than once in one document. |
| `HTML_TRANSFORM_FAILED` | An enabled generated-HTML transform could not process one page. |
| `HTML_DIRECTIVE_UNKNOWN` | An actual `pannonico-*` attribute is not an implemented directive. |
| `HTML_DIRECTIVE_INVALID` | A known directive has invalid placement, duplication, or malformed start-tag syntax. |
| `HTML_DIRECTIVE_RENAMED` | The removed `data-pannonico-inline-css` attribute must be replaced with `pannonico-inline-css`. |
| `HTML_DIRECTIVE_REWRITE_FAILED` | A directive could not be removed safely, was not consumed by its command, or remained after formatting. |
| `REPORT_WRITE_FAILED` | An explicitly requested JSON report could not be written safely. |
| `VITE_MANIFEST_READ_FAILED` | The configured Vite manifest is absent or unreadable. |
| `VITE_MANIFEST_INVALID` | A selected manifest has invalid records, graph references, or missing output. |
| `VITE_MANIFEST_FORMAT_UNSUPPORTED` | No registered adapter supports the manifest or its schema marker. |
| `VITE_MANIFEST_FORMAT_AMBIGUOUS` | Several automatic adapters match; set `vite.manifestFormat`. |
| `VITE_MANIFEST_FORMAT_MISMATCH` | An explicit `manifestFormat` does not match the manifest. |
| `VITE_ENTRY_INVALID` | A configured alias resolves to zero, several, or a non-entry record. |
| `VITE_RESOURCE_INVALID` | A configured resource alias does not resolve to one emitted manifest file. |
| `VITE_ARTIFACT_UNSAFE` | Vite output contains an unsafe path, symlink, type, or collision. |
| `VITE_COMMAND_FAILED` | A configured native Vite build command failed. |
| `VITE_PROCESS_UNAVAILABLE` | Vite process execution is absent from the target. |
| `VITE_DEV_SERVER_UNAVAILABLE` | Pro watch could not start, refresh, or reach Vite. |
| `OUTPUT_PLAN_INVALID` | A final generated or copied artifact has an incomplete, inconsistent, or non-portable identity. |
| `OUTPUT_COPY_READ_FAILED` | A pass-through source could not be reread safely or changed after JSON preflight. |
| `OUTPUT_PATH_UNSAFE` | The configured physical output or one of its ancestors is unsafe immediately before mutation. |
| `OUTPUT_TARGET_EXISTS` | An additive target already exists and will not be replaced. |
| `OUTPUT_STAGING_CREATE_FAILED` | A sibling staging directory could not be created or assigned safe metadata. |
| `OUTPUT_WRITE_FAILED` | A planned artifact could not be written completely and synced in staging. |
| `OUTPUT_VERIFY_FAILED` | The staged tree differs from the complete immutable plan. |
| `OUTPUT_PROMOTION_FAILED` | Staging could not replace the final tree through the backup-first promotion sequence. |
| `OUTPUT_ROLLBACK_FAILED` | Previous output could not be restored; `.dist.backup/previous` retains the recovery tree for default output. |
| `OUTPUT_CLEANUP_FAILED` | An owned staging, backup, or newly created empty ancestor could not be removed safely. |

WASI target limitations use `CAPABILITY_UNSUPPORTED` because the command is
known but absent from the effective target capability set. Node launcher
integrity and package-selection failures are launcher-owned errors rather than
Go build diagnostics.

Manifest-format failures state that the configured site output was not
replaced. Report a new schema through the support channel that supplied
Pannonico and provide only sanitized evidence. The diagnostic does not expose
local source, launcher, or artifact repository paths.
