'use strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import type { Config } from '../../../src/types/config'

// Comfortably above SIZE_THRESHOLD (1 MiB): large enough that a
// materialize-then-forward regression would balloon RSS by ~100 MB, but
// small enough to hash/commit quickly as a git plumbing fixture.
const BLOB_SIZE = 105 * 1024 * 1024
const BLOB_PATH = 'big.bin'
// Generous ceiling for the RSS delta a genuinely chunked pipe should cause:
// stream high-water marks are tens of KB, not the blob size.
const RSS_DELTA_CEILING = 64 * 1024 * 1024

const tempDirs: string[] = []

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

// A tiled short pattern (not raw random bytes): the loose object this
// becomes compresses to well under 1 MB on disk, keeping the fixture fast
// to hash/commit. What this AC guards against is GitAdapter buffering the
// full DECOMPRESSED content client-side — deflate's own compression ratio
// on the source bytes is orthogonal to that and would otherwise leave the
// RSS ceiling hostage to the object store's unrelated I/O characteristics
// for incompressible content.
const buildBlobContent = (): Buffer => {
  const pattern = Buffer.from(
    'the quick brown fox jumps over the lazy dog 0123456789 '
  )
  const content = Buffer.alloc(BLOB_SIZE)
  for (let offset = 0; offset < BLOB_SIZE; offset += pattern.length) {
    pattern.copy(
      content,
      offset,
      0,
      Math.min(pattern.length, BLOB_SIZE - offset)
    )
  }
  return content
}

const runGitText = (args: string[], cwd: string, input?: Buffer): string =>
  execFileSync('git', args, { cwd, input, maxBuffer: 1024 * 1024 })
    .toString('utf8')
    .trim()

// Builds a commit for a single large blob via plumbing only (hash-object +
// mktree + commit-tree): porcelain `git commit` would consult the host's
// `commit.gpgsign`, which this throwaway fixture repo has no business
// triggering. commit-tree never signs unless `-S` is passed explicitly.
const commitLargeBlob = (repoDir: string, content: Buffer): string => {
  execFileSync('git', ['init', '--quiet'], { cwd: repoDir })
  const blobOid = runGitText(['hash-object', '-w', '--stdin'], repoDir, content)
  const treeOid = runGitText(
    ['mktree'],
    repoDir,
    Buffer.from(`100644 blob ${blobOid}\t${BLOB_PATH}\n`)
  )
  return runGitText(['commit-tree', treeOid, '-m', 'add large blob'], repoDir)
}

const makeConfig = (overrides: Partial<Config>): Config => ({
  to: 'HEAD',
  from: 'HEAD',
  output: '',
  source: ['.'],
  repo: '',
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

afterAll(async () => {
  await GitAdapter.closeAll()
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a repository with a large non-LFS blob', () => {
  describe('When streamContent reads it', () => {
    it('Then RSS grows by only a bounded delta, not by the blob size', async () => {
      // Arrange
      const repoDir = await createTempDir('sgd-stream-memory-')
      const content = buildBlobContent()
      const commitOid = commitLargeBlob(repoDir, content)
      const sut = GitAdapter.getInstance(makeConfig({ repo: repoDir }))

      // Act
      const baselineRss = process.memoryUsage().rss
      let peakRss = baselineRss
      let receivedBytes = 0
      for await (const chunk of sut.streamContent({
        oid: commitOid,
        path: BLOB_PATH,
      })) {
        receivedBytes += (chunk as Buffer).length
        const currentRss = process.memoryUsage().rss
        if (currentRss > peakRss) peakRss = currentRss
      }

      // Assert
      expect(receivedBytes).toBe(BLOB_SIZE)
      expect(peakRss - baselineRss).toBeLessThan(RSS_DELTA_CEILING)
    })
  })
})
