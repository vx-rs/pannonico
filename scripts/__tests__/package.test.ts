// Imports
// -----------------------------------------------------------------------------
// Node.js
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// External
import { test } from 'vitest'

// Internal
import { NATIVE_TARGETS, WASI_TARGET } from '../../src/lib/targets.js'
import {
  artifactPayloadFiles,
  createArtifactManifest,
  createLauncherManifest,
  LAUNCHER_FILES,
  LICENSE_DIGESTS,
  PRIVATE_SOURCE_PACKAGE_FILES,
  validateNpmVersion,
} from '../../dist/tools/scripts/package-metadata.js'
import { installedTestTemporaryRoot } from '../../dist/tools/scripts/test-installed-package.js'
import { verifySourcePackage } from '../../dist/tools/scripts/verify-package.js'

// Types
import type { PackageProductIdentity } from '../../dist/tools/scripts/types.js'

// Fixtures
// -----------------------------------------------------------------------------

const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCE = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
)
const PRODUCT: PackageProductIdentity = {
  edition: 'free',
  pairs: NATIVE_TARGETS.map(target => ({ target: target.target })),
  productVersion: '1.2.3-rc.1',
  sourceRevision: 'a'.repeat(40),
  wasi: { sha256: 'c'.repeat(64), size: 42 },
}
const MEMBER = { sha256: 'b'.repeat(64) }
const TEST_TARGET = NATIVE_TARGETS[2]
if (TEST_TARGET === undefined)
  throw new Error('native target fixture is missing')

// Generated metadata
// -----------------------------------------------------------------------------

test('Expect package metadata to generate the unscoped launcher with bundled WASI and six optional native versions when evaluating installed-package contracts', () => {
  const manifest = createLauncherManifest(SOURCE, PRODUCT, 'public')
  assert.equal(manifest.name, 'pannonico')
  assert.equal(manifest.version, PRODUCT.productVersion)
  assert.equal(manifest.private, undefined)
  assert.equal(
    manifest.license,
    '(PolyForm-Noncommercial-1.0.0 OR PolyForm-Small-Business-1.0.0)',
  )
  assert.equal(manifest.homepage, 'https://github.com/vx-rs/pannonico')
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: 'https://github.com/vx-rs/pannonico',
  })
  assert.deepEqual(manifest.bugs, {
    url: 'https://github.com/vx-rs/pannonico/issues',
  })
  assert.deepEqual(manifest.publishConfig, {
    access: 'public',
    registry: 'https://registry.npmjs.org',
  })
  assert.equal(manifest.dependencies, undefined)
  assert.deepEqual(manifest.pannonico.wasi, {
    path: WASI_TARGET.payload,
    sha256: PRODUCT.wasi.sha256,
    size: PRODUCT.wasi.size,
    target: WASI_TARGET.target,
  })
  assert.deepEqual(
    manifest.optionalDependencies,
    Object.fromEntries(
      NATIVE_TARGETS.map(({ packageName }) => [
        packageName,
        PRODUCT.productVersion,
      ]),
    ),
  )
  assert.equal(manifest.scripts, undefined)
  assert.equal(SOURCE.name, '@vx.rs/pannonico')
  assert.equal(SOURCE.private, true)
})

test('Expect package metadata to keep all development Pro metadata private and rejects Pro public output when evaluating installed-package contracts', () => {
  const pro: PackageProductIdentity = { ...PRODUCT, edition: 'pro' }
  const launcher = createLauncherManifest(SOURCE, pro, 'development')
  const native = createArtifactManifest(
    SOURCE,
    pro,
    TEST_TARGET,
    MEMBER,
    'development',
  )
  for (const manifest of [launcher, native]) {
    assert.equal(manifest.private, true)
    assert.equal(manifest.publishConfig, undefined)
    assert.equal(manifest.repository, undefined)
    assert.equal(manifest.pannonico.edition, 'pro')
  }
  assert.throws(
    () => createLauncherManifest(SOURCE, pro, 'public'),
    /rejects Pro/,
  )
  assert.throws(
    () => createArtifactManifest(SOURCE, pro, TEST_TARGET, MEMBER, 'public'),
    /rejects Pro/,
  )
})

test('Expect package metadata to reject input when given Go-legal versions that npm cannot represent exactly', () => {
  for (const value of [
    '1',
    '01.2.3',
    '1.2.3+build',
    '1.2',
    '1.2.3 beta',
    '1.2.3-01',
    '1.2.3-alpha..1',
  ]) {
    assert.throws(
      () => validateNpmVersion(value),
      /not a supported npm version/,
    )
  }
  assert.equal(validateNpmVersion('0.0.0-dev'), '0.0.0-dev')
  assert.equal(validateNpmVersion('12.34.56-rc.1'), '12.34.56-rc.1')
})

test('Expect package metadata to declare exact full-file allowlists for launcher and executable packages when evaluating installed-package contracts', () => {
  // Runtime and declaration inventories must be explicit, and WASI is the only binary payload.
  assert.equal(new Set(LAUNCHER_FILES).size, LAUNCHER_FILES.length)
  assert.ok(LAUNCHER_FILES.includes('dist/js/bin/pannonico.js'))
  assert.ok(LAUNCHER_FILES.includes('dist/types/lib/launcher.d.ts'))
  assert.ok(LAUNCHER_FILES.includes('runtime/pannonico.wasm'))
  assert.deepEqual(artifactPayloadFiles(TEST_TARGET), [
    'LICENSE',
    'LICENSES/PolyForm-Noncommercial-1.0.0.md',
    'LICENSES/PolyForm-Small-Business-1.0.0.md',
    'README.md',
    'bin/pannonico',
    'package.json',
  ])
})

test('Expect package metadata to bind source legal files to the approved chooser and official license bytes when evaluating installed-package contracts', () => {
  for (const [relative, expectedDigest] of Object.entries(LICENSE_DIGESTS)) {
    const bytes = readFileSync(path.join(PACKAGE_ROOT, ...relative.split('/')))
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      expectedDigest,
      relative,
    )
  }
})

test('Expect package metadata to dry-pack the checked-in source package as private runtime source only when evaluating installed-package contracts', async () => {
  const files = await verifySourcePackage(PACKAGE_ROOT)
  assert.deepEqual(files, [...PRIVATE_SOURCE_PACKAGE_FILES].sort())
})

test('Expect installed checks to use the selected temporary parent when configured', async () => {
  const temporaryParent = await mkdtemp(
    path.join(os.tmpdir(), 'pannonico-installed-root-'),
  )
  const configured = path.join(temporaryParent, 'child')
  try {
    assert.equal(
      await installedTestTemporaryRoot({
        PANNONICO_INSTALLED_TEST_TMPDIR: configured,
      }),
      await realpath(configured),
    )
  } finally {
    await rm(temporaryParent, { force: true, recursive: true })
  }
})

test('Expect installed checks to use os.tmpdir when no parent override exists', async () => {
  await mkdir(os.tmpdir(), { recursive: true })
  assert.equal(
    await installedTestTemporaryRoot({}),
    await realpath(os.tmpdir()),
  )
})

test('Expect installed checks to use os.tmpdir when the parent override is empty', async () => {
  await mkdir(os.tmpdir(), { recursive: true })
  assert.equal(
    await installedTestTemporaryRoot({ PANNONICO_INSTALLED_TEST_TMPDIR: '' }),
    await realpath(os.tmpdir()),
  )
})
