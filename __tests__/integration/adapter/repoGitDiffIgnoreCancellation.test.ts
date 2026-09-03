'use strict'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import type { Config } from '../../../src/types/config'
import { IgnoreHelper } from '../../../src/utils/ignoreHelper'
import RepoGitDiff from '../../../src/utils/repoGitDiff'
import {
  buildIgnoreFixtureRepo,
  IGNORE_BUNDLE_MARKUP,
  IGNORE_BUNDLE_STALE_MARKUP,
  IGNORE_MOVED_CLASS,
  IGNORE_MOVED_CLASS_META,
  IGNORE_SOURCE_CLASS,
  IGNORE_SOURCE_CLASS_META,
  type IgnoreFixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// An addition the global ignore rejects is held, not dropped: it cancels the
// matching deletion only when, at `to`, nothing of its component is visible
// outside the ignore set. A class moved wholesale into an ignored directory
// therefore yields nothing — no destructive entry for a component that still
// exists — while an ignored copy of a component that is still alive cannot
// suppress a real deletion. The first case below was the guard that pinned
// the previous ignore-first ordering; it was flipped on purpose when the gate
// moved, not rediscovered by accident.
//
// The real RepoGitDiff drives a real GitAdapter and a real IgnoreHelper
// reading a real pattern file here — the unit seam mocks both
// buildIgnoreHelper and the `to`-tree read, so only this file exercises a
// real pattern file against a real tree.
//
// The second block pins the trap the held-addition rule exists to avoid:
// one file of a live bundle moved into the ignored directory is a stale
// copy, not a move — the bundle's other files are still at `to` — so its
// deletion must survive under every ordering. Both cases hold on the
// ignore-first ordering and must keep holding once the gate moves.

let fixtureDir: string
let ignorePatternPath: string
let refs: IgnoreFixtureRefs
let globalMetadata: MetadataRepository

// Structurally enforces "identical to the no-ignore baseline" rather than
// leaving it as a hand-copied literal in more than one case.
const NO_IGNORE_BASELINE = [
  `A\t${IGNORE_MOVED_CLASS}`,
  `A\t${IGNORE_MOVED_CLASS_META}`,
]
const SOURCE_DELETION_SURVIVES = [
  `D\t${IGNORE_SOURCE_CLASS}`,
  `D\t${IGNORE_SOURCE_CLASS_META}`,
]

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: refs.moved,
  from: refs.root,
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ignore: '',
  ignoreDestructive: '',
  ...overrides,
})

const collect = async (
  lines: AsyncIterable<string>
): Promise<readonly string[]> => {
  const result: string[] = []
  for await (const line of lines) result.push(line)
  return result
}

beforeAll(async () => {
  fixtureDir = await createTempDir('sgd-ignore-cancellation-fixture-')
  refs = buildIgnoreFixtureRepo(fixtureDir)
  globalMetadata = await getDefinition({})
  // _buildIgnore reads this with a plain fs.readFile, which resolves a
  // relative path against process.cwd() rather than the fixture directory —
  // the path handed to config.ignore/ignoreDestructive must be absolute.
  ignorePatternPath = join(fixtureDir, '.sgdignore-recycle-bin')
  await writeFile(ignorePatternPath, 'force-app/recycle-bin/\n')
})

afterEach(async () => {
  // Both GitAdapter and IgnoreHelper cache a singleton keyed on the first
  // call, so a later test in this file would otherwise reuse whichever
  // instance an earlier one built.
  await GitAdapter.closeAll()
  IgnoreHelper.resetIgnoreInstance()
})

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true })
})

describe('Given a class moved wholesale into a directory an ignore pattern covers', () => {
  it('When --ignore-file covers the move destination, Then the source deletion is cancelled and nothing is yielded', async () => {
    // Arrange
    const config = makeConfig({ ignore: ignorePatternPath })
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual([])
  })

  it('When no ignore file is configured, Then the deletion cancels against the addition', async () => {
    // Arrange
    const config = makeConfig()
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual(NO_IGNORE_BASELINE)
  })

  it('When --ignore-destructive-file covers the move destination, Then the result is identical to the no-ignore baseline', async () => {
    // Arrange — keep() routes A/M lines through the global ignore and only D
    // lines through the destructive one, so a destructive-only pattern can
    // never suppress an addition.
    const config = makeConfig({ ignoreDestructive: ignorePatternPath })
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual(NO_IGNORE_BASELINE)
  })

  it('When --source-dir excludes the move destination, Then the source deletion survives instead of being cancelled', async () => {
    // Arrange — a pathspec applied inside GitAdapter, upstream of every gate.
    const config = makeConfig({ source: sourceDirs('force-app/main') })
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual(SOURCE_DELETION_SURVIVES)
  })
})

describe('Given one bundle file moved into an ignored directory while the bundle stays live', () => {
  it('When --ignore-file covers the destination, Then the deletion survives instead of being cancelled', async () => {
    // Arrange — the bundle's script and meta file are still at `to`, so the
    // recycle-bin copy is stale and cannot stand in for the component.
    const config = makeConfig({ to: refs.staleCopy, ignore: ignorePatternPath })
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual([`D\t${IGNORE_BUNDLE_MARKUP}`])
  })

  it('When no ignore file is configured, Then the kept addition cancels the deletion', async () => {
    // Arrange — pins that the survival above comes from the ignore verdict,
    // not from the diff shape.
    const config = makeConfig({ to: refs.staleCopy })
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual([`A\t${IGNORE_BUNDLE_STALE_MARKUP}`])
  })
})
