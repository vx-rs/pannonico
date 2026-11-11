// Imports
// -----------------------------------------------------------------------------
// Node.js
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Internal
import { nativeTargetByName } from '../src/lib/targets.js'
import { verifyPackageSet } from './package-set.js'
import { testInstalledAPI } from './test-installed-api.js'

// Types
import type { Edition } from '../src/lib/types.js'
import type { PackageSetManifest } from './types.js'

// Constants
// -----------------------------------------------------------------------------

const MAX_CLI_OUTPUT_BYTES = 4 * 1024 * 1024
const DOCUMENTATION_HELP_FOOTER =
  'Documentation site: https://github.com/vx-rs/pannonico\n'

// Types
// -----------------------------------------------------------------------------
interface InstalledCommandOptions {
  cwd?: string
  environment?: NodeJS.ProcessEnv
}

interface InstalledCommandResult {
  status: number
  stderr: string
  stdout: string
}

interface InstalledPackageOptions {
  edition: Edition
  installRoot: string
  packageManifest: string
}

// Process boundary
// -----------------------------------------------------------------------------

/**
 * runInstalledNode executes one bounded Node process inside the installed package workspace.
 *
 * Installed CLI and startup-fallback acceptance share this process boundary so both inherit the
 * same workspace, environment, output limits, and failure reporting without invoking a shell.
 *
 * @param {string} installRoot Installed workspace root.
 * @param {string[]} nodeArguments Arguments passed to the current Node executable.
 * @param {{cwd?: string, environment?: NodeJS.ProcessEnv}} options Process context.
 * @returns {Promise<{status: number, stderr: string, stdout: string}>} Bounded completed result.
 */
const runInstalledNode = async (
  installRoot: string,
  nodeArguments: string[],
  options: InstalledCommandOptions = {},
): Promise<InstalledCommandResult> => {
  return new Promise<InstalledCommandResult>((resolve, reject) => {
    execFile(
      process.execPath,
      nodeArguments,
      {
        cwd: options.cwd ?? installRoot,
        encoding: 'buffer',
        env: options.environment ?? process.env,
        // Keep each stream bounded while the callback enforces the original
        // combined stdout/stderr limit.
        maxBuffer: MAX_CLI_OUTPUT_BYTES + 1,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (stdout.length + stderr.length > MAX_CLI_OUTPUT_BYTES) {
          reject(
            new Error('installed Pannonico output exceeded the test limit'),
          )
          return
        }
        if (
          error !== null &&
          typeof error.code !== 'number' &&
          error.signal === undefined
        ) {
          reject(error)
          return
        }
        const status =
          error === null
            ? 0
            : typeof error.code === 'number'
              ? error.code
              : null
        const signal = error?.signal ?? null
        const result = {
          status: status ?? 1,
          stderr: stderr.toString('utf8'),
          stdout: stdout.toString('utf8'),
        }
        if (status !== 0) {
          reject(
            new Error(
              `installed Pannonico failed with status ${status ?? `signal ${signal}`}: ${result.stdout}${result.stderr}`,
              { cause: error },
            ),
          )
        } else {
          resolve(result)
        }
      },
    )
  })
}

/**
 * runInstalledCLI executes the generated launcher with normal package resolution.
 *
 * No artifact root or resolver override is passed. The installed launcher must locate the native
 * tarball through Node's ordinary module algorithm and return the guest's exact status.
 *
 * @param {string} installRoot Installed workspace root.
 * @param {string[]} args Product arguments.
 * @param {{cwd?: string, environment?: NodeJS.ProcessEnv}} options Process context.
 * @returns {Promise<{status: number, stderr: string, stdout: string}>} Bounded completed result.
 */
const runInstalledCLI = async (
  installRoot: string,
  args: string[],
  options: InstalledCommandOptions = {},
): Promise<InstalledCommandResult> => {
  const launcher = path.join(
    installRoot,
    'node_modules',
    'pannonico',
    'dist',
    'js',
    'bin',
    'pannonico.js',
  )
  try {
    return await runInstalledNode(installRoot, [launcher, ...args], options)
  } catch (error) {
    throw new Error(
      `installed CLI ${args[0] ?? 'invocation'} failed: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    )
  }
}

/**
 * runInstalledStartupFallback injects one classified pre-start native error into installed modules.
 *
 * The fixture imports only code from the installed launcher, keeps real native and bundled-WASI
 * verification, and runs the actual WASI guest. Injection occurs at `main`'s documented process
 * seam, so no test flag or alternate artifact root enters production behavior.
 *
 * @param {string} installRoot Installed workspace root.
 * @param {NodeJS.ProcessEnv} environment Process environment with launcher diagnostics enabled.
 * @returns {Promise<{status: number, stderr: string, stdout: string}>} Completed fallback result.
 */
const runInstalledStartupFallback = async (
  installRoot: string,
  environment: NodeJS.ProcessEnv,
): Promise<InstalledCommandResult> => {
  const launcherRoot = path.join(installRoot, 'node_modules', 'pannonico')
  const launcherURL = pathToFileURL(
    path.join(launcherRoot, 'dist', 'js', 'lib', 'launcher.js'),
  ).href
  const runnerURL = pathToFileURL(
    path.join(launcherRoot, 'dist', 'js', 'lib', 'run-native.js'),
  ).href
  const program = `
    const { main } = await import(${JSON.stringify(launcherURL)});
    const { NativeStartupError } = await import(${JSON.stringify(runnerURL)});
    const cause = Object.assign(new Error("installed startup fixture"), { code: "ENOEXEC" });
    process.exitCode = await main(["--version"], {
      runNative: async () => { throw new NativeStartupError(cause); },
    });
  `
  return runInstalledNode(
    installRoot,
    ['--input-type=module', '--eval', program],
    { environment },
  )
}

/**
 * assertVersionOutput checks the installed guest identity without constraining target diagnostics.
 *
 * @param {{stdout: string}} result Completed CLI result.
 * @param {Record<string, unknown>} packageSet Verified package set.
 * @param {string} label Test mode label.
 * @param {string} expectedTarget Exact guest target expected from `--version`.
 */
const assertVersionOutput = (
  result: InstalledCommandResult,
  packageSet: PackageSetManifest,
  label: string,
  expectedTarget: string,
): void => {
  if (
    !result.stdout.includes(`pannonico ${packageSet.productVersion}`) ||
    !result.stdout.includes(`(${packageSet.edition}, ${expectedTarget})`)
  ) {
    throw new Error(
      `${label} returned unexpected version output: ${result.stdout}`,
    )
  }
}

/**
 * assertHelpOutput verifies the released root/manual help identity and the
 * repository documentation footer without constraining unrelated commands.
 *
 * @param {{stdout: string}} result Completed CLI result.
 * @param {string} label Test mode label.
 * @param {string} releaseHelpFooter Stable documentation link emitted by the installed binary.
 */
const assertHelpOutput = (
  result: InstalledCommandResult,
  label: string,
  releaseHelpFooter: string,
): void => {
  if (
    !result.stdout.includes(
      'Pannonico is a deterministic static site generator built around pages, layouts, partials, and structured data.',
    ) ||
    !result.stdout.includes(releaseHelpFooter)
  ) {
    throw new Error(`${label} returned unexpected root help: ${result.stdout}`)
  }
}

/**
 * installedTestTemporaryRoot resolves the parent for disposable installed-package smoke roots.
 *
 * macOS may expose `os.tmpdir()` below the `/var` alias, which the scaffold path guard rejects as
 * a symlinked ancestor. Callers may provide a non-symlink temporary root; other local runs keep
 * the platform default. The returned path is always canonical so later `mkdtemp`
 * calls create operation directories under the same path contract the installed CLI validates.
 *
 * @param {NodeJS.ProcessEnv} environment Process environment.
 * @returns {Promise<string>} Canonical temporary root for this test process.
 */
export const installedTestTemporaryRoot = async (
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> => {
  const configured = environment['PANNONICO_INSTALLED_TEST_TMPDIR']
  const root =
    configured === undefined || configured === '' ? os.tmpdir() : configured
  await mkdir(root, { recursive: true })
  return realpath(root)
}

// Public installed smoke
// -----------------------------------------------------------------------------

/**
 * testInstalledPackage exercises native selection and isolated missing-native WASI fallback.
 *
 * Version, help, representative scaffold, and build run through the installed CLI. One
 * installed-module fixture classifies a pre-start native error; another copies the install and
 * removes only the current native package. Exact guest target output proves that both fallback
 * cases run the launcher's bundled WASI file; focused launcher tests separately own the stable
 * fallback diagnostics.
 *
 * @param {{edition: "free" | "pro", installRoot: string, packageManifest: string}} options Explicit test inputs.
 * @returns {Promise<void>} Resolves after native and fallback installed-byte checks pass.
 */
export const testInstalledPackage = async (
  options: InstalledPackageOptions,
): Promise<void> => {
  const releaseHelpFooter = DOCUMENTATION_HELP_FOOTER
  const packageSet = verifyPackageSet(options.packageManifest, {
    expectedEdition: options.edition,
  })
  const installRoot = path.resolve(options.installRoot)
  const currentNative = packageSet.packages.find(record => {
    if (record.role !== 'native') return false
    const contract = nativeTargetByName(record.target)
    return (
      contract?.platform === process.platform &&
      contract.architecture === process.arch
    )
  })
  if (currentNative === undefined) {
    throw new Error(
      `package set has no native package for ${process.platform}/${process.arch}`,
    )
  }
  const environment = { ...process.env }
  const version = await runInstalledCLI(installRoot, ['--version'], {
    environment,
  })
  assertVersionOutput(
    version,
    packageSet,
    'native installed CLI',
    currentNative.target,
  )
  assertHelpOutput(
    await runInstalledCLI(installRoot, ['--help'], { environment }),
    'native installed CLI',
    releaseHelpFooter,
  )
  const startupFallback = await runInstalledStartupFallback(
    installRoot,
    environment,
  )
  assertVersionOutput(
    startupFallback,
    packageSet,
    'startup-unusable installed CLI',
    'wasip1-wasm',
  )
  const temporaryRoot = await installedTestTemporaryRoot(environment)
  const operationRoot = await mkdtemp(
    path.join(temporaryRoot, 'pannonico-installed-operation-'),
  )
  const fallbackRoot = await mkdtemp(
    path.join(temporaryRoot, 'pannonico-installed-fallback-'),
  )
  try {
    const site = path.join(operationRoot, 'site')
    await mkdir(site)
    await runInstalledCLI(installRoot, ['scaffold', '--with-docs', site], {
      cwd: operationRoot,
      environment,
    })
    await readFile(path.join(site, 'pages', 'index.html'))
    const nativeManual = await readFile(
      path.join(site, 'documentation', 'README.md'),
    )
    const nativeEjectRoot = path.join(operationRoot, 'native-manual')
    await mkdir(nativeEjectRoot)
    const manualHelp = await runInstalledCLI(installRoot, ['manual'], {
      environment,
    })
    if (!manualHelp.stdout.includes(releaseHelpFooter)) {
      throw new Error(
        `native manual help returned unexpected output: ${manualHelp.stdout}`,
      )
    }
    await runInstalledCLI(installRoot, ['manual', '--eject', nativeEjectRoot], {
      environment,
    })
    const nativeEjectedManual = await readFile(
      path.join(nativeEjectRoot, 'documentation', 'README.md'),
    )
    if (!nativeManual.equals(nativeEjectedManual)) {
      throw new Error(
        'native scaffold and manual ejection documentation differ',
      )
    }
    await runInstalledCLI(installRoot, ['build', site], {
      cwd: operationRoot,
      environment,
    })

    const isolatedInstall = path.join(fallbackRoot, 'install')
    await cp(installRoot, isolatedInstall, { recursive: true })
    await rm(
      path.join(
        isolatedInstall,
        'node_modules',
        ...currentNative.name.split('/'),
      ),
      {
        force: true,
        recursive: true,
      },
    )
    const fallback = await runInstalledCLI(isolatedInstall, ['--version'], {
      environment,
    })
    assertVersionOutput(
      fallback,
      packageSet,
      'missing-native installed CLI',
      'wasip1-wasm',
    )
    assertHelpOutput(
      await runInstalledCLI(isolatedInstall, ['--help'], { environment }),
      'missing-native installed CLI',
      releaseHelpFooter,
    )
    const fallbackSite = path.join(operationRoot, 'wasi-site')
    await mkdir(fallbackSite)
    await runInstalledCLI(
      isolatedInstall,
      ['scaffold', '--with-docs', fallbackSite],
      {
        cwd: operationRoot,
        environment,
      },
    )
    await readFile(path.join(fallbackSite, 'pages', 'index.html'))
    const fallbackManual = await readFile(
      path.join(fallbackSite, 'documentation', 'README.md'),
    )
    const fallbackEjectRoot = path.join(operationRoot, 'wasi-manual')
    await mkdir(fallbackEjectRoot)
    await runInstalledCLI(
      isolatedInstall,
      ['manual', '--eject', fallbackEjectRoot],
      {
        environment,
      },
    )
    const fallbackEjectedManual = await readFile(
      path.join(fallbackEjectRoot, 'documentation', 'README.md'),
    )
    if (
      !fallbackManual.equals(fallbackEjectedManual) ||
      !fallbackManual.equals(nativeManual)
    ) {
      throw new Error(
        'native, WASI, scaffold, and manual ejection documentation differ',
      )
    }
    await runInstalledCLI(isolatedInstall, ['build', fallbackSite], {
      cwd: operationRoot,
      environment,
    })
    const relativeSite = path.join(operationRoot, 'relative-site')
    for (const directory of ['pages', 'layouts', 'partials', 'data'])
      await mkdir(path.join(relativeSite, directory), { recursive: true })
    await writeFile(
      path.join(relativeSite, 'pannonico.yaml'),
      'version: 1\nsitemap:\n  enabled: false\n',
    )
    await writeFile(
      path.join(relativeSite, 'pages/index.html'),
      '{{.data.site.title}}',
    )
    await writeFile(
      path.join(relativeSite, 'data/site.json'),
      '{"title":"invocation-relative"}',
    )
    for (const installed of [installRoot, isolatedInstall]) {
      await runInstalledCLI(
        installed,
        [
          'build',
          '--html-validation',
          'off',
          '--data',
          'relative-site/data',
          '--report-json',
          'relative-site/report.json',
          'relative-site',
        ],
        { cwd: operationRoot, environment },
      )
      assert.match(
        await readFile(path.join(relativeSite, 'dist/index.html'), 'utf8'),
        /invocation-relative/,
      )
      assert.equal(
        JSON.parse(
          await readFile(path.join(relativeSite, 'report.json'), 'utf8'),
        ).success,
        true,
      )
      await rm(path.join(relativeSite, 'report.json'))
    }
    if (options.edition === 'pro') {
      // A disposable committed key fixture keeps installed tests independent of ssh-keygen.
      await cp(
        new URL('../../../test/fixtures/signing/key', import.meta.url),
        path.join(relativeSite, 'key'),
      )
      await cp(
        new URL('../../../test/fixtures/signing/key.pub', import.meta.url),
        path.join(relativeSite, 'key.pub'),
      )
      await writeFile(
        path.join(relativeSite, 'pannonico.yaml'),
        'version: 1\nsite:\n  url: https://example.com\nsitemap:\n  enabled: false\nsigning:\n  enabled: true\n  privateKey: key\n  publicKey: key.pub\n',
      )
      const nativeDNS = await runInstalledCLI(
        installRoot,
        ['signing-dns', 'relative-site'],
        { cwd: operationRoot, environment },
      )
      const wasiDNS = await runInstalledCLI(
        isolatedInstall,
        ['signing-dns', 'relative-site'],
        { cwd: operationRoot, environment },
      )
      assert.match(nativeDNS.stdout, /_pannonico\.example\.com/)
      assert.equal(wasiDNS.stdout, nativeDNS.stdout)
    }
  } finally {
    await rm(operationRoot, { force: true, recursive: true })
    await rm(fallbackRoot, { force: true, recursive: true })
  }
  await testInstalledAPI(installRoot, options.edition)
}

// CLI
// -----------------------------------------------------------------------------

/**
 * parseArguments reads the installed-package smoke test inputs.
 *
 * @param {string[]} argv Arguments excluding Node and script paths.
 * @returns {{edition: "free" | "pro", installRoot: string, packageManifest: string}} Parsed inputs.
 */
export const parseArguments = (argv: string[]): InstalledPackageOptions => {
  const result: Partial<InstalledPackageOptions> = {}
  const names = new Map<string, keyof InstalledPackageOptions>([
    ['--edition', 'edition'],
    ['--install-root', 'installRoot'],
    ['--package-manifest', 'packageManifest'],
  ])
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    const name = flag === undefined ? undefined : names.get(flag)
    if (
      name === undefined ||
      typeof value !== 'string' ||
      value === '' ||
      value.startsWith('--')
    ) {
      throw new Error(
        'Usage: test-installed-package --package-manifest PATH --install-root DIR --edition free|pro',
      )
    }
    if (Object.hasOwn(result, name))
      throw new Error(`${flag} may be supplied only once`)
    Object.assign(result, { [name]: value })
  }
  if (
    !result.packageManifest ||
    !result.installRoot ||
    (result.edition !== 'free' && result.edition !== 'pro')
  ) {
    throw new Error(
      'Usage: test-installed-package --package-manifest PATH --install-root DIR --edition free|pro',
    )
  }
  return result as InstalledPackageOptions
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  testInstalledPackage(parseArguments(process.argv.slice(2))).then(
    () =>
      console.log('Installed native and bundled-WASI fallback paths passed.'),
    error => {
      console.error(
        `Installed Pannonico test failed: ${error instanceof Error ? error.message : error}`,
      )
      process.exitCode = 1
    },
  )
}
