# Built-in MCP server

Pannonico includes a bounded stdio Model Context Protocol server:

```text
pannonico mcp [root]
```

The server is a machine-facing adapter over the same configuration, discovery,
data, template, localization, render, validation, report, Vite, and publication
services used by `pannonico build`. It does not implement a second build path,
provide generic filesystem operations, manage watch processes, or contain AI
logic. Source changes remain the responsibility of the client's normal editor
and filesystem tools.

## Starting a session

The optional root is resolved and fixed before protocol initialization. With no
root, native Pannonico uses the process working directory; it never searches
parents for `pannonico.yaml`. An invalid or non-directory root fails startup on
stderr. A malformed project configuration remains inspectable through tool
results after a valid root starts.

A generic client definition looks like this:

```json
{
  "command": "/absolute/path/to/pannonico",
  "args": ["mcp", "/absolute/path/to/site"]
}
```

For nested projects, configure a separate MCP server for each marked root:

```json
{
  "pannonico-parent": {
    "command": "/absolute/path/to/pannonico",
    "args": ["mcp", "/absolute/path/to/site"]
  },
  "pannonico-docs": {
    "command": "/absolute/path/to/pannonico",
    "args": ["mcp", "/absolute/path/to/site/pages/docs"]
  }
}
```

The parent tools never inspect, validate, render, or build child-owned pages or
data. The child loads its own configuration and does not inherit parent data,
templates, navigation, remote sources, Vite settings, or output. The tool and
resource schemas are unchanged because ownership is enforced by the shared
build pipeline.

Client-specific configuration keys and lifecycle behavior are outside
Pannonico's contract. The executable reads newline-delimited protocol JSON from
stdin and reserves stdout exclusively for protocol JSON. Diagnostics and any
configured Vite child output go to stderr. Closing stdin is a normal clean
shutdown. Each input frame is limited to 4 MiB including its newline. The
legacy batch form can contain at most 64 request messages. The server admits
at most eight complete request frames ahead of processing and stops reading
until earlier requests finish when that budget is full.

## Using with coding agents

Once configured, you normally do not need to instruct an agent how to call
individual Pannonico tools. A suitable project instruction is:

> Use Pannonico's MCP tools when inspecting, validating, rendering, or building
> this project. Use normal editor/filesystem tools to modify source files.

## Tools

| Tool | Input | Result and use | Effects |
| --- | --- | --- | --- |
| `inspect_project` | `{}` | Resolved safe configuration, page output/public-URL identities and sitemap exclusion controls, sitemap policy/plan state, layouts, partials, data-source provenance, copied files, localization, Vite metadata, available capabilities, validity, and diagnostic counts. | Fresh full dry run; may fetch configured remote data. |
| `validate_project` | `{}` | `{valid, report}` using the current schema-v1 report, including sitemap plan state. Use after edits and before publication. An invalid project is an ordinary successful result with `valid: false`. | Fresh full dry run; may fetch configured remote data. |
| `inspect_page` | `{"sourcePath":"pages/about.html"}` | Exact page identity, output/public URL path, compiler format, controls including sitemap exclusion, selected layout, partials, localization, and page-relevant diagnostics. | Fresh full dry run; missing or invalid paths set `isError`. |
| `render_page` | `{"sourcePath":"pages/about.html"}` | Already-rendered UTF-8 HTML, identities, and page-relevant diagnostics. Available HTML is successful even when another page or final validation makes the project invalid. | Fresh full dry run; generated HTML contains authored content. |
| `build` | `{}` | Publication state, output path, rendered count, and current schema-v1 report, including generated sitemap state and build-level image metadata information. | Real production build; may replace output, run configured Vite work, and fetch remote data. Destructive and non-idempotent. |

`sourcePath` is the exact slash-separated project-relative identity returned by
`inspect_project`, not an absolute path, route, output path, glob, or basename.
Empty, unclean, parent-traversing, backslash, and absolute values are rejected.

The read-only tools deliberately run the complete current dry pipeline for
every call. There is no cache, watcher, snapshot ID, or invalidation graph.
This preserves edit visibility and core semantics. It also means a Pro project
using `data.urls` can repeat remote requests; clients should avoid redundant
inspection sequences when those sources have cost or rate limits.

## Resources

The server exposes only immutable user documentation embedded in the running
binary. It never reads documentation from the source checkout or network:

- `pannonico://docs` is the installed manual index.
- `pannonico://docs/<area>` is an area index, such as
  `pannonico://docs/authoring`.
- `pannonico://docs/<area>/<topic>` is one detailed topic, such as
  `pannonico://docs/authoring/configuration`.

Earlier flat names remain compatibility resources. For example,
`pannonico://docs/templates` returns the same bytes as
`pannonico://docs/authoring/templates-and-layouts`. MCP clients discover the
complete installed set with `resources/list` and fetch relevant bytes on demand
with `resources/read`; the entire manual is not sent with every tool call.

There are no resource templates and no arbitrary filesystem resource lookup.
Tool descriptions remain self-contained so a client can discover the safe
workflow before reading a topic. Maintainer documentation is not embedded and
cannot be read through MCP.

## Protocol compatibility

The built-in server uses the official MCP Go SDK v1.7.0. The SDK advertises and
negotiates supported protocol revisions through normal discovery and legacy
initialization flows. Clients should use that negotiation instead of assuming
one hard-coded protocol revision.

## Result and error semantics

Tool outputs use generated input and output JSON schemas and include structured
content plus a JSON text fallback. Malformed JSON-RPC and unsupported protocol
operations can fail at the protocol layer. Tool input, execution, and expected
domain failures use MCP tool-error results where a response can still be
delivered:

- validation findings return `valid: false` with `isError: false`;
- a missing page or unavailable render returns `isError: true` with the result;
- successful requested-page HTML returns `isError: false` independently of
  project-wide validity;
- failed or unpublished build output returns `isError: true` with its report.

Only `validate_project` and `build` return the complete schema-v1 report.
`inspect_project` returns validity and warning/error counts, while page and
render inspection return only diagnostics related to the requested page. This
keeps repeated editing workflows from returning the same global diagnostics in
every tool result. If a focused page result is unavailable and its diagnostics
do not identify the blocker, call `validate_project` for the global report.
The schema-v1 report follows the pre-1.0 compatibility policy. A later 0.x
release may change it, but published versions and their matching documentation
remain immutable and breaking changes include migration notes. The current
schema includes sitemap planning/publication fields. Capability denials use
their existing diagnostic notes; the report has no separate capability
discovery field.

Reference failures use the same build truth as the CLI and editor, but MCP is a
fresh request/response surface rather than a watcher:

| Change | Complete MCP tools | Focused MCP tools |
| --- | --- | --- |
| Remove an evaluated local data key or direct navigation page | `validate_project` and `build` include `TEMPLATE_EXECUTION_FAILED`; `inspect_project` exposes the resulting error count. | `inspect_page` and `render_page` include the failure only for a related requested page. |
| Remove a literal partial | Complete reports include `TEMPLATE_MISSING_PARTIAL`. | Related page/render results include it; unrelated pages omit it. |
| Remove a selected layout | Complete reports include `LAYOUT_MISSING`. | The page selecting that layout includes it; unrelated pages omit it. |

Every later read-only call reruns the current dry pipeline, so restoring the
source is visible without restarting the MCP server. Literal missing partials
and selected layouts are preflight failures. A direct data/navigation action in
an inactive template branch may be statically red in the editor while MCP has
no execution failure for that branch; neither surface guesses reachability.

All project operations are serialized to prevent dry-run/build overlap in one
output tree. A canceled request can leave the queue without acquiring the
operation token. Request and session cancellation are passed into dry runs,
remote data, and configured child work. Session cancellation also prevents
queued calls from entering core work. A non-cancelable filesystem step may
finish before the request returns.

## Security and trust boundary

Starting the server authorizes one fixed root and the operations exposed for
that root. The `build` tool can replace the configured output tree and, on an
eligible native runtime, execute the exact structured Vite command authored in
project configuration. Read-only tools can perform authored Pro remote-data
requests. Clients should therefore apply approval policy to `build` and treat
untrusted project configuration as executable/network-capable input.

Inspection is an allowlisted projection rather than a serialization of core
snapshots. It uses `.` for the root and project-relative identities elsewhere.
It excludes source bodies, decoded local or remote data, Vite command
executables and arguments, environment variables, and host absolute paths.
Remote provenance removes credentials, query strings, and fragments; malformed
URLs become `[redacted-invalid-url]`. Diagnostics follow their existing safe
Pannonico messages. Invalid `SOURCE_DATE_EPOCH` diagnostics identify the
required format without reflecting the inherited value. `render_page` and
`build` necessarily expose or publish authored content and are not
secret-scanning tools.

The server exposes neither host filesystem tools nor HTTP endpoints, sampling,
prompts, logging control, completion, subscriptions, or watch management.

## Editions and WASI

`mcp (v1)` is compiled into Free and Pro native and WASI products. Their five
tool schemas and documentation resource scheme are identical. Only
`inspect_project` returns the full runtime discovery envelope: the actual
edition, target, and ordered available capabilities matching
`pannonico capabilities`. Schema-v1 reports and page/render results retain
their documented narrower shapes. Unavailable features keep normal Pannonico
diagnostics through MCP build and dry-run paths. On WASI, only the production
MCP `build` emits `VITE_COMMAND_SKIPPED_TARGET` for an authored Vite production
command before consuming a valid prebuilt manifest; the four dry-run-backed
tools do not emit that warning.

When a distribution exposes MCP through a WASI launcher, the launcher preopens
one project and passes its guest identity as `/project`. The guest cannot infer
a host working directory and can access only that preopen. Native MCP clients
should normally execute the native Pannonico binary. Read the
[WASI runtime reference](../reference/wasi.md) for the portable boundary.

## Troubleshooting

- Use `pannonico mcp --help` to verify command syntax.
- Use `pannonico capabilities` to verify `mcp (v1)` and edition features.
- If initialization fails, check the root and ensure wrappers write nothing to
  stdout before protocol frames.
- If validation returns an invalid report, fix its diagnostics and call
  `validate_project` again.
- If page inspection fails, copy the exact `source.sourcePath` value from
  `inspect_project`.
- If calls appear repetitive, remember that freshness is intentional; no MCP
  result cache exists.
