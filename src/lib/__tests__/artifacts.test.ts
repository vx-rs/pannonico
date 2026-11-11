// Imports
// -----------------------------------------------------------------------------
// Node.js
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// External
import { test } from 'vitest'

// Internal
import {
  PackageUnavailableError,
  validateLauncherManifest,
  verifyBundledWasi,
  verifyInstalledPackage,
} from '../artifacts.js'
import {
  NATIVE_TARGETS,
  nativeTargetByName,
  selectNativeTarget,
  WASI_TARGET,
} from '../targets.js'

// Types
import type { Edition, LauncherIdentity, NativeTarget } from '../types.js'

// Fixtures
// -----------------------------------------------------------------------------

const NATIVE_BYTES = Buffer.from('verified installed payload\n')
const WASI_BYTES = Buffer.from('verified bundled WASI payload\n')
const WASI_IDENTITY = {
  path: WASI_TARGET.payload,
  sha256: createHash('sha256').update(WASI_BYTES).digest('hex'),
  size: WASI_BYTES.length,
  target: WASI_TARGET.target,
}
const LAUNCHER: LauncherIdentity = {
  edition: 'free',
  sourceRevision: 'development',
  version: '1.2.3-test.1',
  wasi: WASI_IDENTITY,
}

interface ArtifactFixtureManifest {
  cpu: string[]
  dependencies?: Record<string, string>
  files: string[]
  license: string
  name: string
  os: NodeJS.Platform[]
  pannonico: {
    edition: Edition
    payload: string
    schema: string
    sha256: string
    sourceRevision: string
    target: string
  }
  private?: true
  publishConfig?: { access: string; registry?: string }
  version: string
}

/**
 * createArtifactFixture writes one generated-package-shaped payload for runtime verification tests.
 *
 * @param {Record<string, string>} contract Native package contract.
 * @param {"free" | "pro"} edition Generated package edition.
 * @returns {{manifest: Record<string, unknown>, manifestPath: string, payloadPath: string, remove: () => void, root: string}} Disposable fixture.
 */
const createArtifactFixture = (
  contract: NativeTarget = NATIVE_TARGETS[2],
  edition: Edition = 'free',
) => {
  const root = mkdtempSync(
    path.join(os.tmpdir(), 'pannonico-installed-artifact-'),
  )
  const payloadPath = path.join(root, ...contract.payload.split('/'))
  mkdirSync(path.dirname(payloadPath), { recursive: true })
  writeFileSync(payloadPath, NATIVE_BYTES, {
    mode:
      contract.platform !== undefined && contract.platform !== 'win32'
        ? 0o755
        : 0o644,
  })
  const manifest: ArtifactFixtureManifest = {
    name: contract.packageName,
    version: LAUNCHER.version,
    license: '(PolyForm-Noncommercial-1.0.0 OR PolyForm-Small-Business-1.0.0)',
    files: [contract.payload],
    pannonico: {
      edition,
      payload: contract.payload,
      schema: 'npm-artifact/v1',
      sha256: createHash('sha256').update(NATIVE_BYTES).digest('hex'),
      sourceRevision: LAUNCHER.sourceRevision,
      target: contract.target,
    },
    cpu: [contract.architecture],
    os: [contract.platform],
    ...(edition === 'pro'
      ? { private: true }
      : {
          publishConfig: {
            access: 'public',
            registry: 'https://registry.npmjs.org',
          },
        }),
  }
  const manifestPath = path.join(root, 'package.json')
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`)
  return {
    manifest,
    manifestPath,
    payloadPath,
    remove: () => rmSync(root, { force: true, recursive: true }),
    root,
  }
}

/**
 * createBundledWasiFixture writes one launcher-shaped package-local portable runtime.
 *
 * Artifact tests use a real manifest path and payload tree so path-type, size, and digest failures
 * exercise the production verifier without package-resolution seams.
 *
 * @returns {{launcher: typeof LAUNCHER, manifestPath: string, payloadPath: string, remove: () => void, root: string}} Disposable fixture.
 */
const createBundledWasiFixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pannonico-bundled-wasi-'))
  const payloadPath = path.join(root, ...WASI_TARGET.payload.split('/'))
  mkdirSync(path.dirname(payloadPath), { recursive: true })
  writeFileSync(payloadPath, WASI_BYTES)
  const manifestPath = path.join(root, 'package.json')
  writeFileSync(manifestPath, '{}\n')
  return {
    launcher: { ...LAUNCHER, wasi: { ...WASI_IDENTITY } },
    manifestPath,
    payloadPath,
    remove: () => rmSync(root, { force: true, recursive: true }),
    root,
  }
}

// Target and launcher identity
// -----------------------------------------------------------------------------

test('Expect artifact verification to map exactly six npm native packages and one bundled WASI path when preparing the selected runtime invocation', () => {
  assert.deepEqual(
    NATIVE_TARGETS.map(({ packageName }) => packageName),
    [
      '@vx.rs/pannonico-darwin-x64',
      '@vx.rs/pannonico-darwin-arm64',
      '@vx.rs/pannonico-linux-x64',
      '@vx.rs/pannonico-linux-arm64',
      '@vx.rs/pannonico-win32-x64',
      '@vx.rs/pannonico-win32-arm64',
    ],
  )
  assert.deepEqual(WASI_TARGET, {
    payload: 'runtime/pannonico.wasm',
    target: 'wasip1-wasm',
  })
  assert.equal(selectNativeTarget('linux', 'x64')?.target, 'linux-amd64')
  assert.equal(selectNativeTarget('win32', 'arm64')?.target, 'windows-arm64')
  assert.equal(selectNativeTarget('aix', 'ppc64'), undefined)
  assert.equal(nativeTargetByName('plan9-amd64'), undefined)
})

test('Expect artifact verification to accept public Free and private development Pro launcher identities when preparing the selected runtime invocation', () => {
  assert.deepEqual(
    validateLauncherManifest({
      name: 'pannonico',
      version: LAUNCHER.version,
      publishConfig: { access: 'public' },
      pannonico: {
        edition: 'free',
        schema: 'npm-launcher/v2',
        sourceRevision: 'development',
        wasi: WASI_IDENTITY,
      },
    }),
    LAUNCHER,
  )
  assert.deepEqual(
    validateLauncherManifest({
      name: 'pannonico',
      version: LAUNCHER.version,
      private: true,
      pannonico: {
        edition: 'pro',
        schema: 'npm-launcher/v2',
        sourceRevision: 'development',
        wasi: WASI_IDENTITY,
      },
    }),
    { ...LAUNCHER, edition: 'pro' },
  )
  assert.throws(
    () =>
      validateLauncherManifest({
        name: 'pannonico',
        version: LAUNCHER.version,
        private: true,
        pannonico: {
          edition: 'free',
          schema: 'npm-launcher/v2',
          sourceRevision: 'development',
          wasi: WASI_IDENTITY,
        },
      }),
    /public Free launcher must not be private/,
  )
  assert.throws(
    () =>
      validateLauncherManifest({
        name: 'pannonico',
        version: LAUNCHER.version,
        pannonico: {
          edition: 'pro',
          schema: 'npm-launcher/v2',
          sourceRevision: 'development',
          wasi: WASI_IDENTITY,
        },
      }),
    /development Pro launcher must be private/,
  )
})

// Installed package verification
// -----------------------------------------------------------------------------

test('Expect artifact verification to verify exact native package metadata and payload bytes when preparing the selected runtime invocation', () => {
  const fixture = createArtifactFixture()
  try {
    assert.equal(
      verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
        resolvePackage: () => fixture.manifestPath,
      }),
      fixture.payloadPath,
    )
  } finally {
    fixture.remove()
  }
})

test('Expect artifact verification to verify bundled WASI identity and package-local payload bytes when preparing the selected runtime invocation', () => {
  const fixture = createBundledWasiFixture()
  try {
    assert.equal(
      verifyBundledWasi(fixture.launcher, {
        launcherManifestPath: fixture.manifestPath,
      }),
      fixture.payloadPath,
    )
  } finally {
    fixture.remove()
  }
})

test('Expect artifact verification to reject input when given missing, corrupt, wrong-size, traversal, and symlinked bundled WASI payloads', () => {
  type BundledFixture = ReturnType<typeof createBundledWasiFixture>
  const cases: Array<[string, (fixture: BundledFixture) => void, RegExp]> = [
    ['missing', fixture => rmSync(fixture.payloadPath), /is missing/],
    [
      'corrupt',
      fixture => {
        const corrupt = Buffer.from(WASI_BYTES)
        corrupt[0] = (corrupt[0] ?? 0) ^ 0xff
        writeFileSync(fixture.payloadPath, corrupt)
      },
      /checksum mismatch/,
    ],
    [
      'wrong size',
      fixture => (fixture.launcher.wasi.size += 1),
      /size mismatch/,
    ],
  ]
  for (const [label, mutate, pattern] of cases) {
    const fixture = createBundledWasiFixture()
    try {
      mutate(fixture)
      assert.throws(
        () =>
          verifyBundledWasi(fixture.launcher, {
            launcherManifestPath: fixture.manifestPath,
          }),
        pattern,
        label,
      )
    } finally {
      fixture.remove()
    }
  }

  assert.throws(
    () =>
      validateLauncherManifest({
        name: 'pannonico',
        version: LAUNCHER.version,
        pannonico: {
          edition: 'free',
          schema: 'npm-launcher/v2',
          sourceRevision: 'development',
          wasi: { ...WASI_IDENTITY, path: '../pannonico.wasm' },
        },
      }),
    /path, target, size, or digest/,
  )
  const invalidWasi: Array<[string, unknown]> = [
    ['target', { ...WASI_IDENTITY, target: 'wasip2-wasm' }],
    ['digest', { ...WASI_IDENTITY, sha256: 'invalid' }],
    ['additional field', { ...WASI_IDENTITY, source: 'outside' }],
  ]
  for (const [label, wasi] of invalidWasi) {
    assert.throws(
      () =>
        validateLauncherManifest({
          name: 'pannonico',
          version: LAUNCHER.version,
          pannonico: {
            edition: 'free',
            schema: 'npm-launcher/v2',
            sourceRevision: 'development',
            wasi,
          },
        }),
      /bundled WASI/,
      label,
    )
  }

  if (process.platform !== 'win32') {
    const fixture = createBundledWasiFixture()
    const outside = path.join(fixture.root, 'outside.wasm')
    try {
      writeFileSync(outside, WASI_BYTES)
      rmSync(fixture.payloadPath)
      symlinkSync(outside, fixture.payloadPath)
      assert.throws(
        () =>
          verifyBundledWasi(fixture.launcher, {
            launcherManifestPath: fixture.manifestPath,
          }),
        /must not traverse a symlink/,
      )
    } finally {
      fixture.remove()
    }
  }
})

test('Expect artifact verification to distinguish only module-not-found from installed package integrity failures when preparing the selected runtime invocation', () => {
  assert.throws(
    () =>
      verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
        resolvePackage: () => {
          throw Object.assign(new Error('missing'), {
            code: 'ERR_MODULE_NOT_FOUND',
          })
        },
      }),
    PackageUnavailableError,
  )
  assert.throws(
    () =>
      verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
        resolvePackage: () => {
          throw Object.assign(new Error('bad package'), {
            code: 'ERR_INVALID_PACKAGE_CONFIG',
          })
        },
      }),
    /Could not resolve installed package/,
  )
})

test('Expect artifact verification to reject input when given mismatched version, edition, revision, target, dependencies, and platform', () => {
  const cases: Array<
    [string, (value: ArtifactFixtureManifest) => void, RegExp]
  > = [
    ['version', value => (value.version = '1.2.4'), /does not match launcher/],
    [
      'edition',
      value => (value.pannonico.edition = 'pro'),
      /edition, revision/,
    ],
    [
      'revision',
      value => (value.pannonico.sourceRevision = 'a'.repeat(40)),
      /edition, revision/,
    ],
    [
      'target',
      value => (value.pannonico.target = 'linux-arm64'),
      /edition, revision/,
    ],
    [
      'dependency',
      value => (value.dependencies = { hidden: '1.0.0' }),
      /must not declare/,
    ],
    ['platform', value => (value.cpu = ['arm64']), /OS or CPU/],
  ]
  for (const [label, mutate, pattern] of cases) {
    const fixture = createArtifactFixture()
    try {
      mutate(fixture.manifest)
      writeFileSync(
        fixture.manifestPath,
        `${JSON.stringify(fixture.manifest)}\n`,
      )
      assert.throws(
        () =>
          verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
            resolvePackage: () => fixture.manifestPath,
          }),
        pattern,
        label,
      )
    } finally {
      fixture.remove()
    }
  }
})

test('Expect artifact verification to reject input when given payload tampering, non-executable native bytes, and symlink payloads', () => {
  const tampered = createArtifactFixture()
  try {
    writeFileSync(tampered.payloadPath, 'tampered\n', { mode: 0o755 })
    assert.throws(
      () =>
        verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
          resolvePackage: () => tampered.manifestPath,
        }),
      /checksum mismatch/,
    )
  } finally {
    tampered.remove()
  }

  if (process.platform !== 'win32') {
    const mode = createArtifactFixture()
    try {
      chmodSync(mode.payloadPath, 0o644)
      assert.throws(
        () =>
          verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
            resolvePackage: () => mode.manifestPath,
          }),
        /not executable/,
      )
    } finally {
      mode.remove()
    }

    const linked = createArtifactFixture()
    const outside = path.join(linked.root, 'outside')
    try {
      writeFileSync(outside, 'verified installed payload\n')
      rmSync(linked.payloadPath)
      symlinkSync(outside, linked.payloadPath)
      assert.throws(
        () =>
          verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
            resolvePackage: () => linked.manifestPath,
          }),
        /must not traverse a symlink/,
      )
    } finally {
      linked.remove()
    }
  }
})

test.skipIf(process.platform === 'win32')(
  'Expect artifact verification to reject input when given a checksum-identical native payload behind an intermediate symlink as an integrity failure',
  () => {
    const fixture = createArtifactFixture()
    const outside = mkdtempSync(
      path.join(os.tmpdir(), 'pannonico-external-artifact-'),
    )
    const payloadDirectory = path.dirname(fixture.payloadPath)
    try {
      writeFileSync(
        path.join(outside, path.basename(fixture.payloadPath)),
        NATIVE_BYTES,
        {
          mode: 0o755,
        },
      )
      rmSync(payloadDirectory, { recursive: true })
      symlinkSync(outside, payloadDirectory, 'dir')
      assert.throws(
        () =>
          verifyInstalledPackage(NATIVE_TARGETS[2], LAUNCHER, {
            resolvePackage: () => fixture.manifestPath,
          }),
        error =>
          error instanceof Error &&
          !(error instanceof PackageUnavailableError) &&
          /must not traverse a symlink/.test(error.message),
      )
    } finally {
      fixture.remove()
      rmSync(outside, { force: true, recursive: true })
    }
  },
)

test('Expect artifact metadata to reject publication when a development Pro package is selected', () => {
  const fixture = createArtifactFixture(NATIVE_TARGETS[2], 'pro')
  const proLauncher: LauncherIdentity = { ...LAUNCHER, edition: 'pro' }
  try {
    assert.equal(
      verifyInstalledPackage(NATIVE_TARGETS[2], proLauncher, {
        resolvePackage: () => fixture.manifestPath,
      }),
      fixture.payloadPath,
    )
    fixture.manifest.publishConfig = { access: 'public' }
    writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest)}\n`)
    assert.throws(
      () =>
        verifyInstalledPackage(NATIVE_TARGETS[2], proLauncher, {
          resolvePackage: () => fixture.manifestPath,
        }),
      /non-publishable/,
    )
  } finally {
    fixture.remove()
  }
})
