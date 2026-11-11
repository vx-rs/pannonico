# Programmatic API

The next npm release built from this source includes the import API. Published
CLI-only versions do not expose these functions. The package requires Node.js
24 or newer and uses ESM; JavaScript and TypeScript share the same functions.

```sh
npm install --save-dev pannonico
```

```ts
import { build, PannonicoError } from 'pannonico'

try {
  const result = await build({ root: './site', out: './dist', jobs: 4 })
  console.log(result.stdout)
} catch (error) {
  if (error instanceof PannonicoError) console.error(error.result)
  throw error
}
```

TypeScript projects also need their compiler and Node.js declarations as
project development dependencies, for example `typescript` and `@types/node`.
The shipped declarations include the Node process and stream types exposed by
the API; these tools are not runtime dependencies of Pannonico.

Every invocation starts this installed package's CLI launcher through the
current Node executable. It verifies and runs its own native binary, or its
bundled verified WASI fallback under the existing selection policy. A global
`pannonico` command, PATH executable, private source checkout, or runtime
download is not used. Importing the package alone starts no process.

## Results, failures, and execution context

Finite functions return `Promise<PannonicoResult>` with `exitCode`, `signal`,
`stdout`, and `stderr`. Output is buffered as UTF-8 until the process and streams
close. Exit 0 resolves. Nonzero exit or signal rejects with `PannonicoError` and
its `result`. Node spawn errors retain `cause`. Binary and launcher diagnostics
are preserved; the caller's exit code is unchanged.

`PannonicoExit` contains `exitCode: number | null` and
`signal: NodeJS.Signals | null`. A signal termination has a null exit code.
Capability denial retains the binary's exit class 4; invalid input retains class
2. See the [CLI reference](../../docs/reference/cli.md) for all exit classes.

Each function accepts optional `ExecutionOptions` after its command options:

```ts
await build({ root: './site' }, {
  cwd: '/absolute/workspace',
  env: { SOURCE_DATE_EPOCH: '0', UNUSED_VALUE: undefined },
})
```

`cwd` defaults to the caller's current directory. `env` overlays a snapshot of
the caller's environment; undefined values remove keys. Parent cwd, environment,
signal listeners, and exit state are never modified. Finite commands ignore
stdin and use the binary's normal noninteractive behavior.

Non-empty roots are resolved against invocation cwd so dash-prefixed names stay
paths. Omitted roots retain binary defaults, and an empty root remains explicit
input for the binary to validate. Other paths keep CLI semantics: output/source overrides are
project-relative; invocation data and report paths are invocation-relative.
WASI retains its existing single-project filesystem and environment boundaries.

## Commands and options

All options are optional. `undefined` emits no flag and retains binary defaults.
False booleans are preserved where the CLI accepts explicit boolean values.
Repeated URL order is preserved; an empty array emits no override and cannot
clear configured URLs. The binary validates combinations, numeric ranges,
configuration, paths, and capability availability.

`build(options?, execution?)` accepts `BuildOptions`:

- `root`: project directory or positional page file.
- `config`, `pages`, `layouts`, `partials`, `data`, `out`: CLI path overrides.
- `dataUrls`: ordered strings mapped to repeated `--data-url`.
- `defaultLayout`, `defaultLanguage`: CLI string overrides.
- `htmlValidation`: `off`, `warn`, or `error`.
- `maxOutputWorkers`, `jobs`: publication and rendering worker settings.
- `dryRun`, `quiet`, `verbose`, `noColor`, `beautify`, `minify`, `help`: booleans.
- `reportJson`: destination for the existing schema-v1 report file.

```ts
import { readFile } from 'node:fs/promises'
import { build } from 'pannonico'

await build({ root: './site', dryRun: true, reportJson: './report.json' })
const report = JSON.parse(await readFile('./report.json', 'utf8'))
console.log(report.success, report.diagnostics)
```

The returned result is process output. Reports remain explicit file output;
the API creates no temporary report, parses no human transcript into a new
schema, and does not load in-memory project configuration.

`scaffold(options?, execution?)` accepts `ScaffoldOptions`: `root`, `empty`,
`min`, `vite`, `withDocs`, `force`, and `help`. `manual(options?, execution?)`
accepts `ManualOptions`: `root`, `eject`, and `help`. Bare manual shows help;
eject writes the binary's version-matched manual below `documentation/`.

```ts
import { scaffold, manual } from 'pannonico'

await scaffold({ root: './new-site', min: true })
await manual({ root: './new-site', eject: true })
```

`signingDns(options?, execution?)` accepts `SigningDnsOptions`: `root`,
`config`, and `help`. It returns the experimental Pro signing helper's TXT-record
output and does not modify DNS.

`capabilities(options?, execution?)` accepts `CapabilitiesOptions` with `help`.
Its stdout contains the exact binary's textual capability list.
`version(execution?)` returns version/edition/target output.
`help(topic?, execution?)` accepts any `HelpTopic`: `build`, `watch`, `scaffold`,
`manual`, `mcp`, `signing-dns`, or `capabilities`; omit the topic for root help.

## Watch and MCP processes

`watch(options?, execution?)` returns `PannonicoProcess` immediately. Its
`child` is a Node `ChildProcess`, and `completed` resolves on successful closure
or rejects on spawn failure, nonzero exit, or signal. Observe completion
immediately. A synchronous Node invocation error can throw before a handle
exists; asynchronous startup failures reject completion. Neither a returned handle nor a spawn event means the server is
ready. Watch inherits stdout/stderr and ignores stdin.

`WatchOptions` includes the applicable build options and adds `host`, `port`,
and `open`. It excludes `dryRun`, `data`, and `dataUrls` because the binary
rejects those in watch. Its positional root must be a directory. Configuration
rules, including remote-data restrictions, remain binary-owned.

```ts
import { watch } from 'pannonico'

const session = watch({ root: './site', port: 8080 })
await session.completed
```

The caller controls termination through `session.child.kill(signal)` according
to Node's platform rules. POSIX signals use the launcher's existing forwarding.
Windows forceful termination does not promise graceful Go/Vite cleanup. There
is no added shutdown protocol, readiness parser, retry, or kill deadline.

`mcp(options?, execution?)` accepts `RootOptions` (`root`, `help`) and returns
the same lifetime handle with piped stdin/stdout/stderr. Connect its streams to
your MCP client, drain output/error, observe `completed`, and end stdin to close
the MCP session. No MCP client dependency is included in this package.

```ts
import { mcp } from 'pannonico'

const session = mcp({ root: './site' })
const completion = session.completed.catch(error => {
  console.error(error)
  throw error
})
session.child.stdout?.pipe(process.stdout)
session.child.stderr?.pipe(process.stderr)
session.child.stdin?.end()
await completion
```

This last example demonstrates stream ownership and EOF, not a protocol client.
A real client performs MCP initialization and request exchange before EOF.
Long-running sessions do not accumulate a transcript in the wrapper.

## Edition and target availability

Native Free and Pro both support page-rendering jobs and managed production
Vite builds. Native Pro adds watch and remote data. Pro native and WASI include
pure transforms and signing; WASI cannot provide native watch, network data,
or managed child Vite processes. Unsupported requests fail with the binary's
capability error instead of silently succeeding.

Public npm distribution remains Free-only. Private development Pro packages
are used for acceptance and do not establish public Pro availability. See the
[capability manual](../../docs/capabilities/README.md) for product semantics.

## Tutorials and tests

Follow [Chapter 31A](https://github.com/vx-rs/pannonico-tutorials/blob/master/source/part-07-professional-workflows/31a-programmatic-npm-api.md)
for a script-based workflow and application-level Vitest examples.
The [maintainer testing guide](../maintainers/testing/README.md) describes
function/flag/process unit coverage and real installed native/WASI acceptance.
