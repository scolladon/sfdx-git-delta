'use strict'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import { GIT_ARCHIVE_DIR_THRESHOLD } from '../../src/adapter/gitBlobReader'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  buildLfsDirCopyFixtureRepo,
  FIXTURE_HOOK_BUDGET_MS,
  LFS_PS_DIR,
  type LfsDirCopyFixtureRefs,
  lfsObjectSettingsPath,
  removeLfsObject,
} from '../__utils__/gitFixtureRepo.ts'
import { createTempDir, runGitText } from '../__utils__/gitTestHarness.ts'

// Pinning apiVersion keeps the run offline.
const API_VERSION = 60
// The dir copy goes through the archive only above the threshold; the PS meta
// file counts, so threshold children is the first archive case and one fewer
// the last per-file one.
const ARCHIVE_CHILD_COUNT = GIT_ARCHIVE_DIR_THRESHOLD
const PER_FILE_CHILD_COUNT = GIT_ARCHIVE_DIR_THRESHOLD - 1
const LFS_POINTER_MARKER = 'version https://git-lfs'
const TMP_SUFFIX = '.tmp'

const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const buildFixture = async (
  childCount: number,
  options: { lfs?: boolean } = {}
): Promise<{ dir: string; refs: LfsDirCopyFixtureRefs }> => {
  const dir = await trackedTempDir('sgd-lfs-dir-copy-fixture-')
  return { dir, refs: buildLfsDirCopyFixtureRepo(dir, childCount, options) }
}

const runSgd = async (
  dir: string,
  refs: LfsDirCopyFixtureRefs
): Promise<string> => {
  const output = await trackedTempDir('sgd-lfs-dir-copy-out-')
  const input: ConfigInput = {
    from: refs.base,
    to: refs.head,
    mergeBase: false,
    output,
    source: ['.'],
    repo: dir,
    ignoreWhitespace: false,
    generateDelta: true,
    apiVersion: API_VERSION,
  }
  await sgd(input)
  return output
}

const listFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
}

const readCopiedPsDir = async (
  output: string
): Promise<Map<string, string>> => {
  const psRoot = join(output, LFS_PS_DIR)
  const files = await listFiles(psRoot)
  const entries = await Promise.all(
    files.map(
      async file =>
        [
          `${LFS_PS_DIR}/${file
            .slice(psRoot.length + 1)
            .split('\\')
            .join('/')}`,
          await readFile(file, 'utf8'),
        ] as const
    )
  )
  return new Map(entries)
}

const expectResolved = (
  copied: Map<string, string>,
  refs: LfsDirCopyFixtureRefs,
  expectedPaths: string[]
): void => {
  expect([...copied.keys()].sort()).toEqual([...expectedPaths].sort())
  for (const [path, content] of copied) {
    expect(content).toBe(refs.contents.get(path))
    expect(content.startsWith(LFS_POINTER_MARKER)).toBe(false)
  }
}

describe('Given a decomposed permission set dir copied by sgd', () => {
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

  describe('When the dir is above the archive threshold and holds LFS pointers', () => {
    it(
      'Then every copied file is the resolved object',
      async () => {
        // Arrange
        const { dir, refs } = await buildFixture(ARCHIVE_CHILD_COUNT)
        const childPath = lfsObjectSettingsPath(2)
        const committed = runGitText(
          ['cat-file', 'blob', `HEAD:${childPath}`],
          {
            cwd: dir,
          }
        )
        expect(committed.startsWith(LFS_POINTER_MARKER)).toBe(true)

        // Act
        const output = await runSgd(dir, refs)
        const copied = await readCopiedPsDir(output)

        // Assert
        expectResolved(copied, refs, [...refs.contents.keys()])
        expect(copied.size).toBe(ARCHIVE_CHILD_COUNT + 1)
      },
      FIXTURE_HOOK_BUDGET_MS
    )
  })

  describe('When the dir is at the threshold and holds LFS pointers', () => {
    it(
      'Then the per-file copy resolves them too',
      async () => {
        // Arrange
        const { dir, refs } = await buildFixture(PER_FILE_CHILD_COUNT)

        // Act
        const output = await runSgd(dir, refs)
        const copied = await readCopiedPsDir(output)

        // Assert
        expectResolved(copied, refs, [...refs.contents.keys()])
        expect(copied.size).toBe(PER_FILE_CHILD_COUNT + 1)
      },
      FIXTURE_HOOK_BUDGET_MS
    )
  })

  describe('When LFS objects are missing for a skipped and a wanted entry', () => {
    it(
      'Then the run resolves, writes neither, and leaves no tmp file',
      async () => {
        // Arrange
        const { dir, refs } = await buildFixture(ARCHIVE_CHILD_COUNT)
        const missing = [lfsObjectSettingsPath(1), lfsObjectSettingsPath(2)]
        for (const path of missing) {
          removeLfsObject(dir, refs.contents.get(path) as string)
        }
        const expectedPaths = [...refs.contents.keys()].filter(
          path => !missing.includes(path)
        )

        // Act
        const output = await runSgd(dir, refs)
        const copied = await readCopiedPsDir(output)

        // Assert
        expectResolved(copied, refs, expectedPaths)
        const leftovers = (await listFiles(output)).filter(file =>
          file.endsWith(TMP_SUFFIX)
        )
        expect(leftovers).toEqual([])
      },
      FIXTURE_HOOK_BUDGET_MS
    )
  })

  describe('When the dir is above the archive threshold and holds plain blobs', () => {
    it(
      'Then every copied file equals its committed bytes',
      async () => {
        // Arrange
        const { dir, refs } = await buildFixture(ARCHIVE_CHILD_COUNT, {
          lfs: false,
        })

        // Act
        const output = await runSgd(dir, refs)
        const copied = await readCopiedPsDir(output)

        // Assert
        expectResolved(copied, refs, [...refs.contents.keys()])
        expect(copied.size).toBe(ARCHIVE_CHILD_COUNT + 1)
      },
      FIXTURE_HOOK_BUDGET_MS
    )
  })
})
