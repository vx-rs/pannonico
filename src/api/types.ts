// Imports
// -----------------------------------------------------------------------------
// Types
import type { ChildProcess } from 'node:child_process'

// Types
// -----------------------------------------------------------------------------
/** Per-invocation process context. Neither property changes the parent process. */
export interface ExecutionOptions {
  /** Invocation directory; defaults to a snapshot of the caller's current directory. */
  cwd?: string
  /** Overlay on the caller's environment. An undefined value removes that key. */
  env?: NodeJS.ProcessEnv
}

/** Filesystem selection shared by commands accepting one project or destination. */
export interface RootOptions {
  /** Project directory, build page, or manual/scaffold destination, depending on the command. */
  root?: string
  /** Display command help instead of performing the operation. */
  help?: boolean
}

/** Existing build flags. Paths and validation retain the binary's CLI semantics. */
export interface BuildOptions extends RootOptions {
  /** Select a project configuration file. */
  config?: string
  /** Select a page file or pages directory. */
  pages?: string
  /** Override the layouts directory. */
  layouts?: string
  /** Override the partials directory. */
  partials?: string
  /** Invocation-relative directory containing YAML/JSON data. */
  data?: string
  /** Ordered remote data URLs; native Pro only. An empty array emits no override. */
  dataUrls?: readonly string[]
  /** Project-relative output directory override. */
  out?: string
  /** Override the default layout name. */
  defaultLayout?: string
  /** Override the default language code. */
  defaultLanguage?: string
  /** Select the existing HTML validation policy. */
  htmlValidation?: 'off' | 'warn' | 'error'
  /** Limit staged-file publication workers independently from page rendering. */
  maxOutputWorkers?: number
  /** Page-rendering workers. Availability and bounds are determined by the binary. */
  jobs?: number
  /** Run the in-memory build phases without publishing the site. */
  dryRun?: boolean
  /** Write the existing JSON report to this invocation-relative file. */
  reportJson?: string
  /** Display only warnings and errors. */
  quiet?: boolean
  /** Display resolved paths and build metadata. */
  verbose?: boolean
  /** Disable diagnostic ANSI colors. */
  noColor?: boolean
  /** Beautify generated HTML; Pro only. */
  beautify?: boolean
  /** Minify generated HTML; Pro only. */
  minify?: boolean
}

/** Native Pro watch flags. The binary rejects dry-run and invocation data in watch. */
export interface WatchOptions extends Omit<
  BuildOptions,
  'dryRun' | 'data' | 'dataUrls'
> {
  /** Preview-server bind host; the binary defaults to 127.0.0.1. */
  host?: string
  /** Preview-server port; the binary defaults to 3000. */
  port?: number
  /** Ask the binary to open the preview URL in a browser. */
  open?: boolean
}

/** Starter selection and overwrite flags, validated by the binary. */
export interface ScaffoldOptions extends RootOptions {
  /** Create only the project directories. */
  empty?: boolean
  /** Create only a minimal configuration file. */
  min?: boolean
  /** Create the edition-matched Vite starter. */
  vite?: boolean
  /** Eject the version-matched manual below documentation/. */
  withDocs?: boolean
  /** Replace known scaffold and documentation files. */
  force?: boolean
}

/** Embedded manual options. Omitting eject displays command help. */
export interface ManualOptions extends RootOptions {
  /** Write the complete manual below the destination root's documentation/. */
  eject?: boolean
}

/** Experimental Signed Resources DNS helper options; requires Pro. */
export interface SigningDnsOptions extends RootOptions {
  /** Select the project configuration containing the signing keys and site URL. */
  config?: string
}

/** Capability discovery accepts only its existing help flag. */
export interface CapabilitiesOptions {
  /** Display capability command help. */
  help?: boolean
}

/** Command topics currently recognized by the binary's help dispatcher. */
export type HelpTopic =
  | 'build'
  | 'watch'
  | 'scaffold'
  | 'manual'
  | 'mcp'
  | 'signing-dns'
  | 'capabilities'

/** Process closure. A signal termination has a null exitCode. */
export interface PannonicoExit {
  /** The package-local launcher's exit code, including the binary's failure class. */
  exitCode: number | null
  /** Signal reported by Node, or null for an ordinary exit. */
  signal: NodeJS.Signals | null
}

/** Finite command output, buffered as UTF-8 until the process and streams close. */
export interface PannonicoResult extends PannonicoExit {
  /** Exact standard output, including any final newline. */
  stdout: string
  /** Exact standard error, including launcher diagnostics. */
  stderr: string
}

/** Caller-owned watch/MCP lifetime. This handle does not imply server readiness. */
export interface PannonicoProcess {
  /** Package-local Node launcher. Use Node's process/stream methods to control it. */
  child: ChildProcess
  /** Observe immediately; rejects on spawn failure, nonzero exit, or termination signal. */
  completed: Promise<PannonicoExit>
}
