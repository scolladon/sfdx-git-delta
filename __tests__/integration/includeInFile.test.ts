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
  IN_FILE_IGNORE_KEPT_LABEL,
  IN_FILE_IGNORE_LABELS,
  IN_FILE_UNTOUCHED_WORKFLOW,
  IN_FILE_UNTOUCHED_WORKFLOW_ALERTS,
  IN_FILE_UNTOUCHED_WORKFLOW_NAME,
  type InFileDestructiveIgnoreFixtureRefs,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// Pinning apiVersion keeps ConfigValidator away from the appexchange lookup —
// this bucket runs behind an unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60
const CUSTOM_LABEL = 'CustomLabel'
const WORKFLOW = 'Workflow'
const WORKFLOW_ALERT = 'WorkflowAlert'

let fixtureDir: string
let refs: InFileDestructiveIgnoreFixtureRefs
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

// _buildInclude resolves a relative path against process.cwd(), so the path
// handed to config must be absolute.
const writePattern = async (path: string): Promise<string> => {
  const file = join(
    await trackedTempDir('sgd-in-file-include-patterns-'),
    'inc'
  )
  await writeFile(file, `${path}\n`)
  return file
}

const writeLabelsPattern = (): Promise<string> =>
  writePattern(IN_FILE_IGNORE_LABELS)

// The fixture's `root` is the repository's first commit AND already holds the
// labels file: the shape where the include passes used to diff against that
// commit's content instead of against nothing.
const runSgd = async (overrides: Partial<ConfigInput>) =>
  sgd({
    to: refs.labelsModified,
    from: refs.root,
    mergeBase: false,
    output: await trackedTempDir('sgd-in-file-include-out-'),
    source: ['force-app'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta: false,
    apiVersion: API_VERSION,
    ...overrides,
  })

const membersOf = (manifest: Manifest, type: string): string[] =>
  [...(manifest.get(type) ?? [])].sort()

const labels = (manifest: Manifest): string[] =>
  membersOf(manifest, CUSTOM_LABEL)

const qualifiedAlerts = IN_FILE_UNTOUCHED_WORKFLOW_ALERTS.map(
  alert => `${IN_FILE_UNTOUCHED_WORKFLOW_NAME}.${alert}`
)

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-in-file-include-fixture-')
  refs = buildInFileDestructiveIgnoreFixtureRepo(fixtureDir)
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
  IgnoreHelper.resetIncludeInstance()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a CustomLabels file already present in the first commit', () => {
  describe('Given an empty range', () => {
    it('When an include destructive covers the labels file, Then every label present at `to` is destructive and nothing is packaged', async () => {
      // Arrange
      const includeDestructive = await writeLabelsPattern()

      // Act
      const work = await runSgd({
        from: refs.labelsModified,
        includeDestructive,
      })

      // Assert
      expect(labels(work.changes.forDestructiveManifest())).toEqual([
        IN_FILE_IGNORE_ADDED_LABEL,
        IN_FILE_IGNORE_KEPT_LABEL,
      ])
      expect(labels(work.changes.forPackageManifest())).toEqual([])
    })

    it('When an include covers the labels file, Then every label present at `to` is packaged and nothing is destructive', async () => {
      // Arrange
      const include = await writeLabelsPattern()

      // Act
      const work = await runSgd({ from: refs.labelsModified, include })

      // Assert
      expect(labels(work.changes.forPackageManifest())).toEqual([
        IN_FILE_IGNORE_ADDED_LABEL,
        IN_FILE_IGNORE_KEPT_LABEL,
      ])
      expect(labels(work.changes.forDestructiveManifest())).toEqual([])
    })
  })

  describe('Given a range deleting one label and adding another', () => {
    it('When an include destructive covers the labels file, Then the deleted and kept labels are destructive and only the added label is packaged', async () => {
      // Arrange
      const includeDestructive = await writeLabelsPattern()

      // Act
      const work = await runSgd({ includeDestructive })

      // Assert
      expect(labels(work.changes.forDestructiveManifest())).toEqual([
        IN_FILE_IGNORE_DELETED_LABEL,
        IN_FILE_IGNORE_KEPT_LABEL,
      ])
      expect(labels(work.changes.forPackageManifest())).toEqual([
        IN_FILE_IGNORE_ADDED_LABEL,
      ])
    })

    it('When an include covers the labels file, Then the added and kept labels are packaged and only the deleted label is destructive', async () => {
      // Arrange
      const include = await writeLabelsPattern()

      // Act
      const work = await runSgd({ include })

      // Assert
      expect(labels(work.changes.forPackageManifest())).toEqual([
        IN_FILE_IGNORE_ADDED_LABEL,
        IN_FILE_IGNORE_KEPT_LABEL,
      ])
      expect(labels(work.changes.forDestructiveManifest())).toEqual([
        IN_FILE_IGNORE_DELETED_LABEL,
      ])
    })
  })
})

// Unlike CustomLabels, a Workflow's container is listed in package.xml
// alongside its members, so this pins the container rule on both passes.
describe('Given a Workflow file present in the first commit and never changed since', () => {
  it('When an include covers it over an empty range, Then the Workflow and every alert are packaged and nothing is destructive', async () => {
    // Arrange
    const include = await writePattern(IN_FILE_UNTOUCHED_WORKFLOW)

    // Act
    const work = await runSgd({ from: refs.labelsModified, include })

    // Assert
    const pkg = work.changes.forPackageManifest()
    expect(membersOf(pkg, WORKFLOW)).toEqual([IN_FILE_UNTOUCHED_WORKFLOW_NAME])
    expect(membersOf(pkg, WORKFLOW_ALERT)).toEqual(qualifiedAlerts)
    expect(
      membersOf(work.changes.forDestructiveManifest(), WORKFLOW_ALERT)
    ).toEqual([])
  })

  it('When an include destructive covers it over an empty range, Then every alert is destructive and the Workflow is not packaged', async () => {
    // Arrange
    const includeDestructive = await writePattern(IN_FILE_UNTOUCHED_WORKFLOW)

    // Act
    const work = await runSgd({ from: refs.labelsModified, includeDestructive })

    // Assert
    expect(
      membersOf(work.changes.forDestructiveManifest(), WORKFLOW_ALERT)
    ).toEqual(qualifiedAlerts)
    expect(membersOf(work.changes.forPackageManifest(), WORKFLOW)).toEqual([])
  })
})
