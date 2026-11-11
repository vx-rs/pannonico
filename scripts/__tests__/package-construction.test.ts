// Imports
// -----------------------------------------------------------------------------
// Node.js
import assert from 'node:assert/strict'
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// External
import { test } from 'vitest'

// Internal
import { NATIVE_TARGETS, selectNativeTarget } from '../../src/lib/targets.js'
import { buildPackageSet } from '../../dist/tools/scripts/build-package-set.js'
import { installPackageSet } from '../../dist/tools/scripts/install-package-set.js'
import { linkLocalFree } from '../../dist/tools/scripts/link-local-free.js'
import { verifyPackageSet } from '../../dist/tools/scripts/package-set.js'
import {
  canonicalJSONString,
  loadProductSet,
  sha256,
} from '../../dist/tools/scripts/product-contract.js'
import { runNpmPack } from '../../dist/tools/scripts/verify-package.js'

// Types
import type { Edition } from '../../src/lib/types.js'
import type { PackageSetManifest } from '../../dist/tools/scripts/types.js'

// Constants
// -----------------------------------------------------------------------------

const SOURCE_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const CURRENT_TARGET = (selectNativeTarget() ?? NATIVE_TARGETS[2]).target
// Canonicalize platform aliases such as macOS /var so fixture identity matches
// the production realpath confinement boundary.
const TEST_TEMP_ROOT = realpathSync.native(os.tmpdir())

interface ProductSetFixtureOptions {
  editions?: Edition[]
  productVersion?: string
  sourceRevision?: string
  targets?: string[]
  varyWasi?: boolean
}

interface MutableLauncherMetadata {
  pannonico: { edition: string }
  version: string
}

// Fixtures
// -----------------------------------------------------------------------------

/**
 * createProductSet writes a complete, canonical Go-owned product-set fixture.
 *
 * The fixture uses small deterministic bytes but preserves the production schema, target paths,
 * file modes, child hashes, pair identities, matrix closure, and manifest-last ordering.
 *
 * @param {{editions?: ("free" | "pro")[], productVersion?: string, sourceRevision?: string, targets?: string[], varyWasi?: boolean}} options Fixture shape.
 * @returns {{manifestPath: string, remove: () => void, root: string}} Disposable product set.
 */
const createProductSet = (options: ProductSetFixtureOptions = {}) => {
  const root = mkdtempSync(path.join(TEST_TEMP_ROOT, 'pannonico-product-set-'))
  const editions = [...(options.editions ?? ['free'])].sort()
  const targets = [...(options.targets ?? [CURRENT_TARGET])].sort()
  const productVersion = options.productVersion ?? '1.2.3-test.1'
  const sourceRevision = options.sourceRevision ?? 'development'
  const pairs = []
  for (const edition of editions) {
    for (const target of targets) {
      const [operatingSystem, architecture] = target.split('-')
      const pairRoot = path.join(root, edition, target)
      const nativePath = target.startsWith('windows-')
        ? 'native/pannonico.exe'
        : 'native/pannonico'
      const native = Buffer.from(`native ${edition} ${target}\n`)
      const wasi = Buffer.from(
        options.varyWasi ? `wasi ${edition} ${target}\n` : `wasi ${edition}\n`,
      )
      mkdirSync(path.join(pairRoot, 'native'), { recursive: true })
      writeFileSync(path.join(pairRoot, ...nativePath.split('/')), native, {
        mode: 0o755,
      })
      chmodSync(path.join(pairRoot, ...nativePath.split('/')), 0o755)
      writeFileSync(path.join(pairRoot, 'pannonico.wasm'), wasi, {
        mode: 0o644,
      })
      const pairIdentity = {
        artifacts: [
          {
            executable: true,
            kind: 'native',
            path: nativePath,
            sha256: sha256(native),
            size: native.length,
            target,
          },
          {
            executable: false,
            kind: 'wasi',
            path: 'pannonico.wasm',
            sha256: sha256(wasi),
            size: wasi.length,
            target: 'wasip1-wasm',
          },
        ],
        edition,
        platform: { arch: architecture, os: operatingSystem },
        product: 'pannonico',
        productVersion,
        schema: 'product-pair/v1',
        sourceRevision,
      }
      const pairManifest = {
        ...pairIdentity,
        pairId: sha256(canonicalJSONString(pairIdentity)),
      }
      const pairBytes = Buffer.from(canonicalJSONString(pairManifest))
      writeFileSync(path.join(pairRoot, 'manifest.json'), pairBytes, {
        mode: 0o644,
      })
      pairs.push({
        edition,
        pairId: pairManifest.pairId,
        path: `${edition}/${target}/manifest.json`,
        platform: pairIdentity.platform,
        sha256: sha256(pairBytes),
        size: pairBytes.length,
        target,
      })
    }
  }
  const setIdentity = {
    editions,
    pairs,
    platforms: targets.map(target => {
      const [operatingSystem, architecture] = target.split('-')
      return { arch: architecture, os: operatingSystem, target }
    }),
    product: 'pannonico',
    productVersion,
    schema: 'product-set/v1',
    sourceRevision,
  }
  const manifest = {
    ...setIdentity,
    setId: sha256(canonicalJSONString(setIdentity)),
  }
  const manifestPath = path.join(root, 'manifest.json')
  writeFileSync(manifestPath, canonicalJSONString(manifest), { mode: 0o644 })
  return {
    manifestPath,
    remove: () => rmSync(root, { force: true, recursive: true }),
    root,
  }
}

/**
 * cloneDirectory creates an isolated mutable copy for negative package-set checks.
 *
 * @param {string} source Existing generated package set.
 * @returns {string} Disposable clone root.
 */
const cloneDirectory = (source: string): string => {
  const root = mkdtempSync(
    path.join(TEST_TEMP_ROOT, 'pannonico-package-set-clone-'),
  )
  cpSync(source, root, { recursive: true })
  return root
}

/**
 * assertLauncherDocumentation verifies the generated package's edition-specific documentation.
 *
 * Free output must reproduce the reviewed npm README exactly. Development Pro output must remain
 * a local-only notice and must not inherit public installation claims.
 *
 * @param {string} packageSetRoot Generated package-set root.
 * @param {"free" | "pro"} edition Expected distribution edition.
 */
const assertLauncherDocumentation = (
  packageSetRoot: string,
  edition: Edition,
): void => {
  const readme = readFileSync(
    path.join(packageSetRoot, 'packages', 'pannonico', 'README.md'),
    'utf8',
  )
  if (edition === 'free') {
    assert.equal(
      readme,
      readFileSync(
        path.join(SOURCE_ROOT, 'documentation', 'npm-readme.md'),
        'utf8',
      ),
    )
    // These fixed destinations implement the established support/security and
    // Marketplace routing contracts; mutable README headings/prose are reviewed.
    for (const required of [
      'https://marketplace.visualstudio.com/items?itemName=vx-rs.pannonico',
      'https://github.com/vx-rs/pannonico/issues',
      'https://github.com/vx-rs/pannonico/security/advisories/new',
    ]) {
      assert.equal(readme.includes(required), true)
    }
  } else {
    assert.ok(readme.trim().length > 0)
  }
}

// Go contract consumption
// -----------------------------------------------------------------------------

test('Expect package construction to validate the full closed Go matrix and requires byte-identical selected WASI when evaluating installed-package contracts', () => {
  const complete = createProductSet({
    editions: ['free', 'pro'],
    targets: NATIVE_TARGETS.map(({ target }) => target),
  })
  try {
    const product = loadProductSet(complete.manifestPath, 'free')
    assert.equal(product.pairs.length, 6)
    assert.deepEqual(
      product.pairs.map(({ target }) => target),
      NATIVE_TARGETS.map(({ target }) => target),
    )
    writeFileSync(path.join(complete.root, 'unexpected.bin'), 'extra\n')
    assert.throws(
      () => loadProductSet(complete.manifestPath, 'free'),
      /not closed/,
    )
  } finally {
    complete.remove()
  }

  const inconsistent = createProductSet({
    targets: ['linux-amd64', 'linux-arm64'],
    varyWasi: true,
  })
  try {
    assert.throws(
      () => loadProductSet(inconsistent.manifestPath, 'free'),
      /different WASI bytes/,
    )
  } finally {
    inconsistent.remove()
  }
})

test('Expect package construction to reject input when given missing, digest-invalid, and malformed product-set inputs', () => {
  const fixture = createProductSet()
  try {
    const set = JSON.parse(readFileSync(fixture.manifestPath, 'utf8'))
    const pairPath = path.join(fixture.root, ...set.pairs[0].path.split('/'))
    writeFileSync(pairPath, `${readFileSync(pairPath, 'utf8')}\n`)
    assert.throws(
      () => loadProductSet(fixture.manifestPath, 'free'),
      /size mismatch/,
    )
  } finally {
    fixture.remove()
  }

  const missing = createProductSet()
  try {
    const set = JSON.parse(readFileSync(missing.manifestPath, 'utf8'))
    rmSync(path.join(missing.root, ...set.pairs[0].path.split('/')))
    assert.throws(
      () => loadProductSet(missing.manifestPath, 'free'),
      /is missing/,
    )
  } finally {
    missing.remove()
  }
})

// Construction and verification
// -----------------------------------------------------------------------------

test('Expect package construction to build and verifies the full public seven-package matrix without mutating source metadata when evaluating installed-package contracts', async () => {
  const product = createProductSet({
    sourceRevision: 'a'.repeat(40),
    targets: NATIVE_TARGETS.map(({ target }) => target),
  })
  const workspace = mkdtempSync(
    path.join(TEST_TEMP_ROOT, 'pannonico-public-packages-'),
  )
  const output = path.join(workspace, 'free')
  const sourceBefore = readFileSync(path.join(SOURCE_ROOT, 'package.json'))
  try {
    const manifestPath = await buildPackageSet({
      edition: 'free',
      mode: 'public',
      outputRoot: output,
      productManifest: product.manifestPath,
    })
    const manifest = verifyPackageSet(manifestPath, { expectedEdition: 'free' })
    assert.equal(manifest.packages.length, 7)
    assert.deepEqual(
      manifest.packages.map(({ name }) => name),
      [
        'pannonico',
        ...NATIVE_TARGETS.map(({ packageName }) => packageName).sort(),
      ],
    )
    assert.equal(
      manifest.packages.some(({ role }) => String(role) === 'wasi'),
      false,
    )
    const launcher = manifest.packages[0]
    if (launcher === undefined)
      throw new Error('generated package set has no launcher')
    assert.deepEqual(launcher.dependencies, {})
    const launcherMetadata = JSON.parse(
      readFileSync(
        path.join(output, ...launcher.directory.split('/'), 'package.json'),
        'utf8',
      ),
    )
    const bundledWasi = readFileSync(
      path.join(
        output,
        ...launcher.directory.split('/'),
        'runtime',
        'pannonico.wasm',
      ),
    )
    const sourceWasi = readFileSync(
      path.join(
        product.root,
        'free',
        NATIVE_TARGETS[0].target,
        'pannonico.wasm',
      ),
    )
    assert.equal(bundledWasi.equals(sourceWasi), true)
    assert.equal(launcherMetadata.pannonico.wasi.size, bundledWasi.length)
    assert.equal(launcherMetadata.pannonico.wasi.sha256, sha256(bundledWasi))
    assertLauncherDocumentation(output, 'free')
    assert.equal(
      readFileSync(path.join(SOURCE_ROOT, 'package.json')).equals(sourceBefore),
      true,
    )

    const tamperedTarball = launcher.filename
    writeFileSync(
      path.join(output, ...tamperedTarball.split('/')),
      'tampered\n',
    )
    assert.throws(() => verifyPackageSet(manifestPath), /size mismatch/)
  } finally {
    product.remove()
    rmSync(workspace, { force: true, recursive: true })
  }
})

test('Expect package construction to reject input when given a release-identity package set without all six native packages', async () => {
  const product = createProductSet({ sourceRevision: 'b'.repeat(40) })
  const workspace = mkdtempSync(
    path.join(TEST_TEMP_ROOT, 'pannonico-incomplete-release-'),
  )
  try {
    await assert.rejects(
      buildPackageSet({
        edition: 'free',
        mode: 'public',
        outputRoot: path.join(workspace, 'free'),
        productManifest: product.manifestPath,
      }),
      /complete six-package native matrix/,
    )
  } finally {
    product.remove()
    rmSync(workspace, { force: true, recursive: true })
  }
})

test('Expect package construction to build local Free and private development Pro sets and rejects mixed public mode when evaluating installed-package contracts', async () => {
  const product = createProductSet({ editions: ['free', 'pro'] })
  const workspace = mkdtempSync(
    path.join(TEST_TEMP_ROOT, 'pannonico-development-packages-'),
  )
  const freeOutput = path.join(workspace, 'free')
  const proOutput = path.join(workspace, 'pro')
  const installRoot = path.join(workspace, 'install-pro')
  try {
    await assert.rejects(
      buildPackageSet({
        edition: 'free',
        mode: 'public',
        outputRoot: path.join(workspace, 'rejected'),
        productManifest: product.manifestPath,
      }),
      /rejects mixed-edition or Pro/,
    )
    const freeManifest = await buildPackageSet({
      edition: 'free',
      mode: 'local-free',
      outputRoot: freeOutput,
      productManifest: product.manifestPath,
    })
    const free = verifyPackageSet(freeManifest)
    assert.equal(free.distribution, 'public')
    assertLauncherDocumentation(freeOutput, 'free')
    let linkedRoot
    await linkLocalFree(freeManifest, {
      link: async launcherRoot => {
        linkedRoot = launcherRoot
      },
    })
    assert.equal(linkedRoot, path.join(freeOutput, 'packages', 'pannonico'))

    const proManifest = await buildPackageSet({
      edition: 'pro',
      mode: 'development-pro',
      outputRoot: proOutput,
      productManifest: product.manifestPath,
    })
    const pro = verifyPackageSet(proManifest, { expectedEdition: 'pro' })
    assert.equal(pro.distribution, 'development')
    for (const record of pro.packages) {
      const metadata = JSON.parse(
        readFileSync(
          path.join(proOutput, ...record.directory.split('/'), 'package.json'),
          'utf8',
        ),
      )
      assert.equal(record.private, true)
      assert.equal(metadata.private, true)
      assert.equal(metadata.publishConfig, undefined)
    }
    const freeLauncher = free.packages.find(
      record => record.role === 'launcher',
    )
    const proLauncher = pro.packages.find(record => record.role === 'launcher')
    if (freeLauncher === undefined || proLauncher === undefined) {
      throw new Error('generated package set has no launcher')
    }
    const freeMetadata = JSON.parse(
      readFileSync(
        path.join(
          freeOutput,
          ...freeLauncher.directory.split('/'),
          'package.json',
        ),
        'utf8',
      ),
    )
    const proMetadata = JSON.parse(
      readFileSync(
        path.join(
          proOutput,
          ...proLauncher.directory.split('/'),
          'package.json',
        ),
        'utf8',
      ),
    )
    assert.notEqual(
      freeMetadata.pannonico.wasi.sha256,
      proMetadata.pannonico.wasi.sha256,
    )

    await installPackageSet({ installRoot, packageManifest: proManifest })
    const lock = readFileSync(
      path.join(installRoot, 'package-lock.json'),
      'utf8',
    )
    assert.doesNotMatch(lock, /https?:\/\/(?:registry\.)?npmjs/)
    assert.doesNotMatch(lock, /@vx\.rs\/pannonico-wasi/)
    assert.match(lock, /file:/)
  } finally {
    product.remove()
    rmSync(workspace, { force: true, recursive: true })
  }
})

test('Expect package construction to reject input when given additional, missing, mismatched-version, and wrong-edition package-set state', async () => {
  const product = createProductSet()
  const workspace = mkdtempSync(
    path.join(TEST_TEMP_ROOT, 'pannonico-package-negative-'),
  )
  const output = path.join(workspace, 'free')
  try {
    const manifestPath = await buildPackageSet({
      edition: 'free',
      mode: 'public',
      outputRoot: output,
      productManifest: product.manifestPath,
    })
    const manifest = verifyPackageSet(manifestPath)

    const additional = cloneDirectory(output)
    try {
      writeFileSync(path.join(additional, 'additional.tgz'), 'extra\n')
      assert.throws(
        () => verifyPackageSet(path.join(additional, 'manifest.json')),
        /not closed/,
      )
    } finally {
      rmSync(additional, { force: true, recursive: true })
    }

    const missing = cloneDirectory(output)
    try {
      const firstPackage = manifest.packages[0]
      if (firstPackage === undefined)
        throw new Error('generated package set is empty')
      rmSync(path.join(missing, ...firstPackage.filename.split('/')))
      assert.throws(
        () => verifyPackageSet(path.join(missing, 'manifest.json')),
        /is missing/,
      )
    } finally {
      rmSync(missing, { force: true, recursive: true })
    }

    const mutationCases: Array<
      [string, (metadata: MutableLauncherMetadata) => void, RegExp]
    > = [
      ['version', metadata => (metadata.version = '9.9.9'), /does not match/],
      [
        'edition',
        metadata => (metadata.pannonico.edition = 'pro'),
        /metadata|private|edition/,
      ],
    ]
    for (const [label, mutate, pattern] of mutationCases) {
      const changed = cloneDirectory(output)
      try {
        const launcherPath = path.join(
          changed,
          'packages',
          'pannonico',
          'package.json',
        )
        const metadata = JSON.parse(
          readFileSync(launcherPath, 'utf8'),
        ) as MutableLauncherMetadata
        mutate(metadata)
        writeFileSync(launcherPath, `${JSON.stringify(metadata, null, 2)}\n`)
        assert.throws(
          () => verifyPackageSet(path.join(changed, 'manifest.json')),
          pattern,
          label,
        )
      } finally {
        rmSync(changed, { force: true, recursive: true })
      }
    }

    const lifecycle = cloneDirectory(output)
    const repack = mkdtempSync(
      path.join(TEST_TEMP_ROOT, 'pannonico-lifecycle-repack-'),
    )
    try {
      const lifecycleManifestPath = path.join(lifecycle, 'manifest.json')
      const lifecycleManifest = JSON.parse(
        readFileSync(lifecycleManifestPath, 'utf8'),
      ) as PackageSetManifest
      const launcher = lifecycleManifest.packages.find(
        record => record.role === 'launcher',
      )
      if (launcher === undefined)
        throw new Error('generated package set has no launcher')
      const launcherRoot = path.join(
        lifecycle,
        ...launcher.directory.split('/'),
      )
      const launcherMetadataPath = path.join(launcherRoot, 'package.json')
      const launcherMetadata = JSON.parse(
        readFileSync(launcherMetadataPath, 'utf8'),
      )
      launcherMetadata.scripts = { postinstall: 'node -e process.exit(99)' }
      writeFileSync(
        launcherMetadataPath,
        `${JSON.stringify(launcherMetadata, null, 2)}\n`,
      )
      const cacheRoot = path.join(repack, 'cache')
      const destination = path.join(repack, 'tarballs')
      mkdirSync(cacheRoot)
      mkdirSync(destination)
      const report = await runNpmPack(launcherRoot, { cacheRoot, destination })
      const repacked = readFileSync(path.join(destination, report.filename))
      writeFileSync(
        path.join(lifecycle, ...launcher.filename.split('/')),
        repacked,
      )
      launcher.size = repacked.length
      launcher.sha256 = sha256(repacked)
      writeFileSync(
        lifecycleManifestPath,
        canonicalJSONString(lifecycleManifest),
      )
      assert.throws(
        () => verifyPackageSet(lifecycleManifestPath),
        /unexpected or missing fields/,
      )
    } finally {
      rmSync(lifecycle, { force: true, recursive: true })
      rmSync(repack, { force: true, recursive: true })
    }
  } finally {
    product.remove()
    rmSync(workspace, { force: true, recursive: true })
  }
})

test('Expect package construction to reject input when given an install nested in the canonical package set reached through an alias', async () => {
  const product = createProductSet()
  const workspace = mkdtempSync(
    path.join(TEST_TEMP_ROOT, 'pannonico-install-alias-'),
  )
  const output = path.join(workspace, 'free')
  const alias = path.join(workspace, 'package-alias')
  try {
    const manifestPath = await buildPackageSet({
      edition: 'free',
      mode: 'public',
      outputRoot: output,
      productManifest: product.manifestPath,
    })
    const manifestBefore = readFileSync(manifestPath)
    symlinkSync(
      output,
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    await assert.rejects(
      installPackageSet({
        installRoot: path.join(output, 'replacement'),
        packageManifest: path.join(alias, 'manifest.json'),
      }),
      /overlapping npm install root/,
    )
    assert.equal(readFileSync(manifestPath).equals(manifestBefore), true)
    verifyPackageSet(manifestPath)
  } finally {
    product.remove()
    rmSync(workspace, { force: true, recursive: true })
  }
})
