'use strict'
import { rm } from 'node:fs/promises'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import { HEAD } from '../../../src/constant/gitConstants'
import type { Config } from '../../../src/types/config'
import {
  buildRefNameFixtureRepo,
  FILES_SHA1,
  FILES_SHA256,
  isRepoFormatSupported,
  REFTABLE_SHA1,
  type RefNameFixture,
  type RepoFormat,
} from '../../__utils__/gitFixtureRepo'
import { createTempDir } from '../../__utils__/gitTestHarness'
import { sourceDirs } from '../../__utils__/sourceDirs'

// vitest collects `it.each` tables at collection time, before any
// `beforeAll` runs — a probe computed inside `beforeAll` would yield
// `it.each([])`, and vitest reports that as an error rather than a skip.
// Running the (synchronous) probe at module scope keeps the candidate list
// non-empty and named in every leg's output.
const CANDIDATE_FORMATS = [FILES_SHA1, REFTABLE_SHA1, FILES_SHA256]
const FORMAT_SUPPORT = new Map(
  CANDIDATE_FORMATS.map(format => [format.name, isRepoFormatSupported(format)])
)
// The ref-name assertions always run against files/sha1 (the actual
// regression guard, never conditional) plus whichever storage formats this
// runner's git binary supports — a reduced run is a named row in the
// candidate-format suite above, never a silent absence here.
const EXERCISED_FORMATS: readonly RepoFormat[] = CANDIDATE_FORMATS.filter(
  format => FORMAT_SUPPORT.get(format.name)
)

describe('Given the runner git binary probed for repository-format support', () => {
  it.each(
    CANDIDATE_FORMATS.map(f => [f.name, FORMAT_SUPPORT.get(f.name)] as const)
  )('When probed for %s support, Then support is %s', (name, verdict) => {
    // Arrange
    const sut = FORMAT_SUPPORT

    // Act
    const result = sut.get(name)

    // Assert
    expect(result).toBe(verdict)
  })

  it('When the probe has run, Then the files/sha1 baseline is supported', () => {
    // Arrange / Act
    const sut = FORMAT_SUPPORT.get(FILES_SHA1.name)

    // Assert
    expect(sut).toBe(true)
  })

  // CI runners carry a modern git that supports every candidate format,
  // including reftable. Without this, a runner that silently drops support
  // for one only shows up as a shorter EXERCISED_FORMATS list further down
  // — a quieter absence, not a failing test.
  it.runIf(process.env.CI)(
    'When running in CI, Then every candidate format is supported',
    () => {
      // Arrange
      const sut = FORMAT_SUPPORT

      // Act / Assert
      for (const format of CANDIDATE_FORMATS) {
        expect(sut.get(format.name)).toBe(true)
      }
    }
  )
})

type FixtureEntry = { dir: string; refs: RefNameFixture }

let fixtures: Map<string, FixtureEntry>
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const makeConfig = (repo: string): Config => ({
  to: HEAD,
  from: HEAD,
  mergeBase: false,
  output: '',
  source: sourceDirs('.'),
  repo,
  ignoreWhitespace: false,
  generateDelta: false,
})

// Building up to 3 fixtures spawns up to ~36 blocking git processes; on a
// cold Windows runner that outruns vitest's 10s default hookTimeout (see
// the same shape in gitAdapterLifecycle.test.ts's CLI_SPAWN_TIMEOUT_MS).
const FIXTURE_BUILD_TIMEOUT_MS = 60_000

beforeAll(async () => {
  fixtures = new Map()
  for (const format of EXERCISED_FORMATS) {
    const dir = await trackedTempDir(
      `sgd-ref-storage-${format.refFormat}-${format.objectFormat}-`
    )
    fixtures.set(format.name, {
      dir,
      refs: buildRefNameFixtureRepo(dir, format),
    })
  }
}, FIXTURE_BUILD_TIMEOUT_MS)

afterEach(async () => {
  // Closing after every test drops the cached repo handle, forcing the
  // next getInstance() to rebuild from the fixture that test actually
  // passed in instead of reusing a sibling test's cached state.
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a real GitAdapter against repositories in every exercised ref-storage format', () => {
  it.each(EXERCISED_FORMATS.map(f => [f.name] as const))(
    'When --from and --to are ref names on a %s repository, Then both resolve to their commits',
    async name => {
      // Arrange
      const { dir, refs } = fixtures.get(name)!
      const sut = GitAdapter.getInstance(makeConfig(dir))
      const expectations: ReadonlyArray<[string, string]> = [
        [refs.tagName, refs.tagOid],
        [refs.branchName, refs.headOid],
        [refs.tag, refs.tagOid],
        [refs.branch, refs.headOid],
        [HEAD, refs.headOid],
        [refs.tagOid, refs.tagOid],
        [refs.headOid, refs.headOid],
      ]

      // Act / Assert
      for (const [ref, expectedOid] of expectations) {
        await expect(sut.parseRev(ref)).resolves.toBe(expectedOid)
      }
    }
  )
})
