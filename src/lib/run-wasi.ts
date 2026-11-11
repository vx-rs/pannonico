// Imports
// -----------------------------------------------------------------------------
// Node.js
import { lstat, readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { WASI } from 'node:wasi'

// Types
import type { DescriptorStream } from './types.js'

// Types
// -----------------------------------------------------------------------------
interface FileInformation {
  isDirectory(): boolean
  isFile?(): boolean
  isSymbolicLink?(): boolean
}

interface WasiFilesystemOptions {
  lstat?: ((selected: string) => Promise<FileInformation>) | undefined
  mkdir?: ((selected: string) => Promise<unknown>) | undefined
  realpath?: ((selected: string) => Promise<string>) | undefined
  stat?: ((selected: string) => Promise<FileInformation>) | undefined
}

interface WasiConfiguration {
  args: string[]
  env: Record<string, string>
  preopens: Record<string, string>
  returnOnExit: true
  stderr: number
  stdin: number
  stdout: number
  version: 'preview1'
}

interface WasiHost {
  /** Run the verified guest synchronously and return its exact process exit status. */
  start(instance: unknown): number
  wasiImport: unknown
}

interface WasiConstructor {
  new (configuration: WasiConfiguration): WasiHost
}

/** Filesystem and environment inputs used while confining one WASI command. */
export interface PrepareWasiOptions extends WasiFilesystemOptions {
  cwd?: string | undefined
  environment?: NodeJS.ProcessEnv | undefined
}

/** Guest arguments, environment, and preopens produced before module execution. */
export interface WasiInvocation {
  args: string[]
  env: Record<string, string>
  preopens: Record<string, string>
}

/** Runtime seams used to execute an already verified WASI module. */
export interface RunWasiOptions extends PrepareWasiOptions {
  Wasi?: WasiConstructor | undefined
  compile?: ((bytes: Uint8Array) => Promise<unknown>) | undefined
  instantiate?:
    | ((module: unknown, imports: Record<string, unknown>) => Promise<unknown>)
    | undefined
  readModule?: ((modulePath: string) => Promise<Uint8Array>) | undefined
  stderr?: DescriptorStream | undefined
  stdin?: DescriptorStream | undefined
  stdout?: DescriptorStream | undefined
}

interface ParsedMcpCommand {
  help: boolean
  root: string | undefined
}

interface ParsedManualCommand {
  eject: boolean
  root: string | undefined
}

interface PathToken {
  name: string
  value: string
}

interface ParsedProjectCommand {
  help: boolean
  root: string | undefined
  tokens: Array<string | PathToken>
}

// Constants
// -----------------------------------------------------------------------------

const GUEST_PROJECT = '/project'
const VALUE_OPTIONS = new Set([
  '--config',
  '--pages',
  '--layouts',
  '--partials',
  '--data',
  '--data-url',
  '--out',
  '--default-layout',
  '--default-language',
  '--html-validation',
  '--report-json',
  '--jobs',
  '--max-output-workers',
])
const PATH_OPTIONS = new Set([
  '--config',
  '--pages',
  '--layouts',
  '--partials',
  '--data',
  '--out',
  '--report-json',
])
const BUILD_FLAGS = new Set([
  '--beautify',
  '--dry-run',
  '--minify',
  '--quiet',
  '--verbose',
  '--no-color',
  '--help',
])
const SCAFFOLD_FLAGS = new Set([
  '--empty',
  '--force',
  '--min',
  '--vite',
  '--with-docs',
  '--help',
])

// Invocation preparation
// -----------------------------------------------------------------------------

/**
 * prepareWasiInvocation converts one supported CLI invocation into a confined guest contract.
 *
 * Informational commands receive no filesystem. Build, manual ejection,
 * scaffold, and MCP receive exactly one real, non-root, non-symlink directory
 * at `/project`; a positional build file uses its parent and guest file
 * identity. Manual ejection and scaffold require that directory to exist
 * before host preparation. Bare/help manual, MCP help, and signing-dns help open nothing. Unknown
 * or escaping syntax rejects before WASI starts.
 *
 * @param {string[]} rawArguments Product command arguments.
 * @param {object} options Working-directory, environment, and filesystem overrides.
 * @returns {Promise<{args: string[], env: Record<string, string>, preopens: Record<string, string>}>} Confined guest invocation.
 */
export const prepareWasiInvocation = async (
  rawArguments: ReadonlyArray<string>,
  options: PrepareWasiOptions = {},
): Promise<WasiInvocation> => {
  const cwd = options.cwd ?? process.cwd()
  const environment = options.environment ?? process.env
  const args = [...rawArguments]
  const command = args[0]
  const env =
    typeof environment['SOURCE_DATE_EPOCH'] === 'string'
      ? { SOURCE_DATE_EPOCH: environment['SOURCE_DATE_EPOCH'] }
      : {}
  if (command === 'mcp') {
    const parsed = parseMcpCommand(args.slice(1))
    if (parsed.help) {
      return { args, env: {}, preopens: {} }
    }
    const selected = path.resolve(cwd, parsed.root ?? '.')
    const realSelected = await validateMcpRoot(selected, options)
    return {
      args: ['mcp', GUEST_PROJECT],
      env: {},
      preopens: { [GUEST_PROJECT]: realSelected },
    }
  }
  if (command === 'manual') {
    const parsed = parseManualCommand(args.slice(1))
    if (!parsed.eject) {
      return { args, env: {}, preopens: {} }
    }
    const selected = path.resolve(cwd, parsed.root ?? '.')
    if (selected === path.parse(selected).root) {
      throw new Error(
        `refusing to preopen filesystem root ${JSON.stringify(selected)}`,
      )
    }
    await validateScaffoldPathComponents(selected, options)
    const realSelected = await (options.realpath ?? realpath)(selected)
    if (path.relative(selected, realSelected) !== '') {
      throw new Error(
        `WASI project root ${JSON.stringify(selected)} contains a symlink`,
      )
    }
    const information = await (options.stat ?? stat)(realSelected)
    if (!information.isDirectory()) {
      throw new Error(
        `WASI manual root ${JSON.stringify(selected)} is not a directory`,
      )
    }
    return {
      args: ['manual', '--eject', GUEST_PROJECT],
      env: {},
      preopens: { [GUEST_PROJECT]: realSelected },
    }
  }
  if (
    command !== 'build' &&
    command !== 'scaffold' &&
    command !== 'signing-dns'
  ) {
    return { args, env, preopens: {} }
  }

  const parsed = parseProjectCommand(command, args.slice(1))
  if (parsed.help) {
    return { args, env, preopens: {} }
  }
  const selected = path.resolve(cwd, parsed.root ?? '.')
  if (selected === path.parse(selected).root) {
    throw new Error(
      `refusing to preopen filesystem root ${JSON.stringify(selected)}`,
    )
  }
  if (command === 'scaffold') {
    await validateScaffoldPathComponents(selected, options)
  }
  const realSelected = await (options.realpath ?? realpath)(selected)
  if (path.relative(selected, realSelected) !== '') {
    throw new Error(
      `WASI project root ${JSON.stringify(selected)} contains a symlink`,
    )
  }
  const information = await (options.stat ?? stat)(realSelected)
  const selectedFile = command === 'build' && information.isFile?.() === true
  const realRoot = selectedFile ? path.dirname(realSelected) : realSelected
  if (realRoot === path.parse(realRoot).root) {
    throw new Error(
      `refusing to preopen filesystem root ${JSON.stringify(realRoot)}`,
    )
  }
  if (!selectedFile && !information.isDirectory()) {
    throw new Error(
      `WASI project root ${JSON.stringify(selected)} is not a directory`,
    )
  }

  const guestSelection = selectedFile
    ? `${GUEST_PROJECT}/${path.basename(realSelected)}`
    : GUEST_PROJECT

  const guestArguments = [command]
  for (const token of parsed.tokens) {
    if (typeof token === 'string') {
      guestArguments.push(token)
      continue
    }
    // CLI data and report options are relative to the invoking shell; configured
    // source/output options retain their project-relative contract.
    const value =
      token.name === '--data' || token.name === '--report-json'
        ? path.resolve(cwd, token.value)
        : token.value
    guestArguments.push(token.name, translatePath(value, realRoot))
  }
  guestArguments.push(guestSelection)
  return { args: guestArguments, env, preopens: { [GUEST_PROJECT]: realRoot } }
}

// Execution
// -----------------------------------------------------------------------------

/**
 * runWasiExecutable starts one locally validated preview1 artifact with confined host access.
 *
 * The launcher validates the fixed path as a regular non-symlink file before calling this boundary.
 * This function reads and compiles those bytes, inherits the selected streams, exposes only the
 * prepared project and approved environment, and returns the guest's exact exit status.
 *
 * @param {string} modulePath Manifest-verified WASI member path.
 * @param {string[]} rawArguments Product command arguments from the launcher.
 * @param {object} options Working-directory, stream, environment, and focused-test overrides.
 * @returns {Promise<number>} Exact preview1 guest exit status.
 * @throws {Error} When invocation confinement, module read, compilation, or instantiation fails.
 */
export const runWasiExecutable = async (
  modulePath: string,
  rawArguments: ReadonlyArray<string>,
  options: RunWasiOptions = {},
): Promise<number> => {
  const invocation = await prepareWasiInvocation(rawArguments, options)
  const Wasi = options.Wasi ?? (WASI as unknown as WasiConstructor)
  const wasi = new Wasi({
    version: 'preview1',
    args: ['pannonico', ...invocation.args],
    env: invocation.env,
    preopens: invocation.preopens,
    stdin: (options.stdin ?? process.stdin).fd,
    stdout: (options.stdout ?? process.stdout).fd,
    stderr: (options.stderr ?? process.stderr).fd,
    returnOnExit: true,
  })
  const bytes = await (options.readModule ?? readFile)(modulePath)
  const module = options.compile
    ? await options.compile(Uint8Array.from(bytes))
    : await WebAssembly.compile(Uint8Array.from(bytes))
  const imports = { wasi_snapshot_preview1: wasi.wasiImport }
  const instance = options.instantiate
    ? await options.instantiate(module, imports)
    : await WebAssembly.instantiate(
        module as WebAssembly.Module,
        imports as WebAssembly.Imports,
      )
  return wasi.start(instance)
}

// Argument parsing
// -----------------------------------------------------------------------------

/**
 * parseMcpCommand assigns MCP arguments their help or root role before filesystem preflight.
 *
 * Only a sole `--help` or `-h` token is filesystem-free. Other flags and multiple roots reject here
 * because the host must establish the exact filesystem grant before WASI construction or compile.
 * An explicit empty root is distinct from omission and cannot fall back to the working directory.
 *
 * @param {string[]} args Arguments following the mcp command.
 * @returns {{help: boolean, root: string | undefined}} Parsed host role assignment.
 */
const parseMcpCommand = (args: ReadonlyArray<string>): ParsedMcpCommand => {
  const onlyArgument = args[0]
  if (
    args.length === 1 &&
    onlyArgument !== undefined &&
    new Set(['--help', '-h']).has(onlyArgument)
  ) {
    return { help: true, root: undefined }
  }
  const unknown = args.find(argument => argument.startsWith('-'))
  if (unknown !== undefined)
    throw new Error(`unknown mcp option ${JSON.stringify(unknown)}`)
  if (args.length > 1) throw new Error('mcp accepts at most one project root')
  const root = args[0]
  if (root === '') throw new Error('project root cannot be empty')
  return { help: false, root }
}

/**
 * parseManualCommand identifies only the filesystem-writing ejection form.
 * Bare help and removed raw-topic forms remain filesystem-free and are passed
 * to Go for the authoritative help or migration diagnostic. A true --eject
 * accepts at most one non-empty root and no additional option.
 *
 * @param {string[]} args Arguments following the manual command.
 * @returns {{eject: boolean, root: string | undefined}} Host role assignment.
 */
const parseManualCommand = (
  args: ReadonlyArray<string>,
): ParsedManualCommand => {
  const eject = args.includes('--eject') || args.includes('--eject=true')
  if (!eject) return { eject: false, root: undefined }
  const positionals: string[] = []
  let seenEject = false
  for (const argument of args) {
    if (argument === '--eject' || argument === '--eject=true') {
      if (seenEject) throw new Error('manual --eject may be supplied only once')
      seenEject = true
      continue
    }
    if (argument.startsWith('-')) {
      throw new Error(
        `unknown manual --eject option ${JSON.stringify(argument)}`,
      )
    }
    positionals.push(argument)
  }
  if (positionals.length > 1) {
    throw new Error('manual --eject accepts at most one destination root')
  }
  if (positionals[0] === '') {
    throw new Error('manual destination root cannot be empty')
  }
  return { eject: true, root: positionals[0] }
}

/**
 * validateMcpRoot resolves the one MCP host directory without following a symlinked input path.
 *
 * The fixed preopen must never be a filesystem root, file, missing path, or path whose canonical
 * identity differs through a symlink. All checks finish before WASI module bytes are read or compiled.
 *
 * @param {string} selected Absolute host path selected by cwd or the explicit positional.
 * @param {object} options Filesystem overrides used by focused tests.
 * @returns {Promise<string>} Canonical non-root directory to preopen.
 */
const validateMcpRoot = async (
  selected: string,
  options: WasiFilesystemOptions,
): Promise<string> => {
  if (selected === path.parse(selected).root) {
    throw new Error(
      `refusing to preopen filesystem root ${JSON.stringify(selected)}`,
    )
  }
  const realSelected = await (options.realpath ?? realpath)(selected)
  if (path.relative(selected, realSelected) !== '') {
    throw new Error(
      `WASI project root ${JSON.stringify(selected)} contains a symlink`,
    )
  }
  const information = await (options.stat ?? stat)(realSelected)
  if (!information.isDirectory()) {
    throw new Error(
      `WASI project root ${JSON.stringify(selected)} is not a directory`,
    )
  }
  return realSelected
}

/**
 * validateScaffoldPathComponents requires one fully existing, lexically safe
 * directory for a scaffold or manual ejection.
 *
 * Host preparation cannot create path components safely through portable Node
 * filesystem APIs because an ancestor could be replaced before a path-string
 * mkdir. Walking with lstat rejects every symlink and non-directory component.
 * A missing component fails closed before canonical inspection, WASI
 * construction, or guest module work; users create it outside this boundary.
 *
 * @param {string} selected Absolute non-root scaffold path.
 * @param {object} options Injectable filesystem operations used by focused tests.
 * @returns {Promise<void>} Resolves when the complete lexical path exists as directories.
 * @throws {Error} When a component is missing, a symlink, a non-directory, or cannot be inspected.
 */
const validateScaffoldPathComponents = async (
  selected: string,
  options: WasiFilesystemOptions,
): Promise<void> => {
  const inspect = options.lstat ?? lstat
  const filesystemRoot = path.parse(selected).root
  const relative = path.relative(filesystemRoot, selected)
  const segments = relative === '' ? [] : relative.split(path.sep)
  let current = filesystemRoot
  for (const segment of segments) {
    current = path.join(current, segment)
    let information
    try {
      information = await inspect(current)
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new Error(
          `WASI scaffold root ${JSON.stringify(selected)} must already exist as a directory`,
        )
      }
      throw error
    }
    if (information.isSymbolicLink?.() === true) {
      throw new Error(
        `WASI project root ${JSON.stringify(selected)} contains a symlink at ${JSON.stringify(current)}`,
      )
    }
    if (!information.isDirectory()) {
      throw new Error(
        `WASI project root ${JSON.stringify(selected)} contains a non-directory component ${JSON.stringify(current)}`,
      )
    }
  }
}

/**
 * parseProjectCommand assigns help, option-value, separator, and project-root roles in one pass.
 *
 * Recognized build options consume their next token before help classification, and tokens after
 * `--` are positional. This keeps help-looking values and roots confined while genuine help stays
 * filesystem-free. It preserves option order, marks paths for translation, distinguishes an omitted
 * root from an explicit empty root, and rejects unsafe grammar before filesystem or WASI work.
 *
 * @param {"build" | "scaffold" | "signing-dns"} command Supported project command.
 * @param {string[]} args Arguments following the command.
 * @returns {{help: boolean, root: string | undefined, tokens: Array<string | {name: string, value: string}>}} Parsed role assignment and guest-visible option tokens.
 */
const parseProjectCommand = (
  command: 'build' | 'scaffold' | 'signing-dns',
  args: ReadonlyArray<string>,
): ParsedProjectCommand => {
  const tokens: Array<string | PathToken> = []
  let help = false
  let root: string | undefined
  let hasRoot = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === '--') {
      const positional = args.slice(index + 1)
      if (hasRoot || positional.length > 1) {
        throw new Error(`${command} accepts at most one project root`)
      }
      if (positional.length === 1) {
        root = positional[0]!
        hasRoot = true
      }
      break
    }
    const equals = argument.startsWith('--') ? argument.indexOf('=') : -1
    const name = equals < 0 ? argument : argument.slice(0, equals)
    if (
      (command === 'build' && VALUE_OPTIONS.has(name)) ||
      (command === 'signing-dns' && name === '--config')
    ) {
      const value = equals < 0 ? args[index + 1] : argument.slice(equals + 1)
      if (typeof value !== 'string' || value === '') {
        throw new Error(`option ${JSON.stringify(name)} requires a value`)
      }
      if (equals < 0) index += 1
      tokens.push(
        PATH_OPTIONS.has(name) ? { name, value } : name,
        ...(PATH_OPTIONS.has(name) ? [] : [value]),
      )
    } else if (
      argument === '--help' ||
      argument === '--help=true' ||
      argument === '-h'
    ) {
      help = true
      tokens.push(argument)
    } else if (
      (command === 'build' && BUILD_FLAGS.has(name)) ||
      (command === 'scaffold' && SCAFFOLD_FLAGS.has(name))
    ) {
      tokens.push(argument)
    } else if (argument.startsWith('-')) {
      throw new Error(`unknown ${command} option ${JSON.stringify(name)}`)
    } else if (!hasRoot) {
      root = argument
      hasRoot = true
    } else {
      throw new Error(`${command} accepts at most one project root`)
    }
  }
  if (hasRoot && root === '') throw new Error('project root cannot be empty')
  return { help, root, tokens }
}

/**
 * translatePath maps an absolute host option into the selected guest project tree.
 *
 * Relative values remain unchanged after proving their host interpretation stays inside the
 * preopen. Absolute values are translated to guest paths. Either form rejects on escape.
 */
const translatePath = (value: string, root: string): string => {
  const relative = path.relative(root, path.resolve(root, value))
  if (isContainedPath(relative)) {
    if (!path.isAbsolute(value)) return value
    return relative === ''
      ? GUEST_PROJECT
      : `${GUEST_PROJECT}/${relative.split(path.sep).join('/')}`
  }
  throw new Error(
    `path ${JSON.stringify(value)} is outside the WASI project root`,
  )
}

/**
 * isContainedPath distinguishes a contained relative path from parent traversal or another root.
 *
 * Dot-prefixed file names remain valid. The exact parent and parent-prefixed paths are rejected so
 * translatePath cannot construct a guest path outside `/project` on either path separator style.
 */
const isContainedPath = (value: string): boolean =>
  value === '' ||
  (!path.isAbsolute(value) &&
    value !== '..' &&
    !value.startsWith(`..${path.sep}`))
