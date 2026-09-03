'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../src/metadata/metadataManager'
import type { Config } from '../../../src/types/config'
import RepoGitDiff from '../../../src/utils/repoGitDiff'
import {
  buildRootAnchoredFixtureRepo,
  type RootAnchoredFixtureRefs,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// A package laid out at the repository root puts every type directory in
// path segment 0 — exactly where a git diff-status letter and tab also
// land. main.ts strips that prefix nowhere before handing paths to the
// registry, so directory-only types (no registry-known suffix, e.g. aura
// and lwc bundles) are invisible, and a plain file at the root keys its
// diff line with the status prefix baked in. Neither case involves the
// cancellation-key rule — stripping the prefix alone is enough
// for both.

let fixtureDir: string
let refs: RootAnchoredFixtureRefs
let globalMetadata: MetadataRepository

const makeConfig = (to: string, from: string): Config => ({
  to,
  from,
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
})

const collect = async (
  lines: AsyncIterable<string>
): Promise<readonly string[]> => {
  const result: string[] = []
  for await (const line of lines) result.push(line)
  return result
}

beforeAll(async () => {
  fixtureDir = await createTempDir('sgd-root-anchored-fixture-')
  refs = buildRootAnchoredFixtureRepo(fixtureDir)
  globalMetadata = await getDefinition({})
})

afterEach(async () => {
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true })
})

describe('Given a fixture repo whose package directory is the repository root', () => {
  it('When every component is deleted, Then the bundle files are reported alongside the class', async () => {
    // Arrange
    const config = makeConfig(refs.deleted, refs.root)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual([
      'D\taura/accountCard/accountCard.cmp',
      'D\taura/accountCard/accountCardController.js',
      'D\tclasses/AccountService.cls',
      'D\tclasses/AccountService.cls-meta.xml',
      'D\tlwc/accountCard/accountCard.html',
      'D\tlwc/accountCard/accountCard.js',
      'D\tlwc/accountCard/accountCard.js-meta.xml',
    ])
  })

  it('When a plain type moves out of the repository root, Then its deletion cancels against the move', async () => {
    // Arrange
    const config = makeConfig(refs.moved, refs.root)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toEqual(['A\tclasses/Ledger.cls'])
  })
})
