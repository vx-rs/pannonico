// Imports
// -----------------------------------------------------------------------------
// Node.js
import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// Types
import type { Edition } from '../src/lib/types.js'

// Constants
// -----------------------------------------------------------------------------
const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const run = promisify(execFile)

// Functions
// -----------------------------------------------------------------------------
/**
 * Compile a real installed-package TS consumer and run native/forced-WASI API acceptance.
 * The fixture imports only pannonico by package name; compiler/types are declared
 * maintainer inputs. No private source or rebuilt candidate is used by this consumer.
 */
export const testInstalledAPI = async (
  installRoot: string,
  edition: Edition,
): Promise<void> => {
  const directory = path.join(installRoot, '.local', 'api-acceptance')
  await mkdir(directory, { recursive: true })
  await copyFile(
    path.join(REPOSITORY_ROOT, 'test', 'fixtures', 'api', 'consumer.mts'),
    path.join(directory, 'consumer.mts'),
  )
  const options = {
    cwd: installRoot,
    // Includes TypeScript compilation and real watch startup/rebuild. This is
    // acceptance's outer failure budget, never a runtime command timeout.
    timeout: 120_000,
  }
  try {
    const compilerManifest = new URL(
      import.meta.resolve('typescript/package.json'),
    )
    const compilerMetadata = JSON.parse(
      await readFile(compilerManifest, 'utf8'),
    )
    // Execute the dependency's declared CLI; its bin is not a module export.
    const compiler = fileURLToPath(
      new URL(compilerMetadata.bin.tsc, compilerManifest),
    )
    await run(
      process.execPath,
      [
        compiler,
        // Explicit fixture files must ignore a parent project's tsconfig (TS5112
        // in TypeScript 7); acceptance supplies its complete compiler options.
        '--ignoreConfig',
        '--module',
        'NodeNext',
        '--target',
        'ES2022',
        '--strict',
        '--skipLibCheck',
        '--types',
        'node',
        '--typeRoots',
        path.join(REPOSITORY_ROOT, 'node_modules', '@types'),
        '--outDir',
        path.join(directory, 'compiled'),
        path.join(directory, 'consumer.mts'),
      ],
      options,
    )
    for (const wasi of [false, true]) {
      await run(
        process.execPath,
        [
          path.join(directory, 'compiled', 'consumer.mjs'),
          edition,
          path.join(REPOSITORY_ROOT, 'test', 'fixtures', 'signing'),
        ],
        {
          ...options,
          env: { ...process.env, PANNONICO_FORCE_WASI: wasi ? '1' : '0' },
        },
      )
    }
  } catch (cause) {
    // TypeScript emits diagnostics on stdout; preserve them in a failed gate.
    const failure = cause as Error & { stdout?: string }
    throw new Error(
      [failure.message, failure.stdout].filter(Boolean).join('\n'),
      { cause },
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
