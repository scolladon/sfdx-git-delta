'use strict'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import type { Manifest } from '../../src/types/work'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  buildInFileDestructiveIgnoreFixtureRepo,
  FIXTURE_HOOK_BUDGET_MS,
  IN_FILE_IGNORE_ADDED_LABEL,
  IN_FILE_IGNORE_DELETED_LABEL,
  IN_FILE_IGNORE_LABELS,
  type InFileDestructiveIgnoreFixtureRefs,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// Pinning apiVersion keeps ConfigValidator away from the appexchange lookup —
// this bucket runs behind an unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60
const CUSTOM_LABEL = 'CustomLabel'

let fixtureDir: string
let refs: InFileDestructiveIgnoreFixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

// _buildIgnore resolves a relative path against process.cwd(), so the path
// handed to config must be absolute.
const writePatterns = async (patterns: string): Promise<string> => {
  const file = join(await trackedTempDir('sgd-in-file-ignore-patterns-'), 'ign')
  await writeFile(file, patterns)
  return file
}

const runSgd = async (overrides: Partial<ConfigInput> = {}) =>
  sgd({
    to: refs.labelsModified,
    from: refs.root,
    mergeBase: false,
    output: await trackedTempDir('sgd-in-file-ignore-out-'),
    source: ['force-app'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta: false,
    apiVersion: API_VERSION,
    ...overrides,
  })

const labels = (manifest: Manifest): string[] =>
  [...(manifest.get(CUSTOM_LABEL) ?? [])].sort()

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-in-file-ignore-fixture-')
  refs = buildInFileDestructiveIgnoreFixtureRepo(fixtureDir)
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
  IgnoreHelper.resetIgnoreInstance()
  IgnoreHelper.resetIncludeInstance()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a CustomLabels file where one label is deleted and one added', () => {
  it('When no ignore file is given, Then the deleted label is destructive and the added label is packaged', async () => {
    // Act
    const work = await runSgd()

    // Assert
    expect(labels(work.changes.forDestructiveManifest())).toEqual([
      IN_FILE_IGNORE_DELETED_LABEL,
    ])
    expect(labels(work.changes.forPackageManifest())).toEqual([
      IN_FILE_IGNORE_ADDED_LABEL,
    ])
  })

  it('When a destructive ignore covers the labels file, Then the deleted label is not destructive and the added label is still packaged', async () => {
    // Arrange
    const ignoreDestructive = await writePatterns(`${IN_FILE_IGNORE_LABELS}\n`)

    // Act
    const work = await runSgd({ ignoreDestructive })

    // Assert
    expect(labels(work.changes.forDestructiveManifest())).toEqual([])
    expect(labels(work.changes.forPackageManifest())).toEqual([
      IN_FILE_IGNORE_ADDED_LABEL,
    ])
  })

  it('When an include destructive also covers the labels file, Then the destructive ignore does not change the include result', async () => {
    // Arrange
    const includeDestructive = await writePatterns(`${IN_FILE_IGNORE_LABELS}\n`)
    const ignoreDestructive = await writePatterns(`${IN_FILE_IGNORE_LABELS}\n`)
    const includeOnly = await runSgd({ includeDestructive })
    IgnoreHelper.resetIncludeInstance()

    // Act
    const work = await runSgd({ ignoreDestructive, includeDestructive })

    // Assert
    expect(labels(work.changes.forDestructiveManifest())).toEqual(
      labels(includeOnly.changes.forDestructiveManifest())
    )
    expect(labels(work.changes.forPackageManifest())).toEqual(
      labels(includeOnly.changes.forPackageManifest())
    )
  })

  it('When a destructive ignore covers another path, Then the deleted label is still destructive', async () => {
    // Arrange
    const ignoreDestructive = await writePatterns('**/classes/**\n')

    // Act
    const work = await runSgd({ ignoreDestructive })

    // Assert
    expect(labels(work.changes.forDestructiveManifest())).toEqual([
      IN_FILE_IGNORE_DELETED_LABEL,
    ])
  })
})
