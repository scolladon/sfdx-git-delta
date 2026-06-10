'use strict'
/*
 * SPIKE harness: runs GitAdapter (git subprocess backend) and TsGitAdapter
 * (@scolladon/tsgit pure-TS backend) side by side against THIS repository
 * and asserts output parity, logging wall-clock timings for each operation.
 */
import { afterAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../../src/adapter/GitAdapter'
import TsGitAdapter from '../../../src/adapter/TsGitAdapter'
import type { Config } from '../../../src/types/config'

const REPO_ROOT = process.cwd()
const FROM = 'HEAD~20'
const TO = 'HEAD'

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: TO,
  from: FROM,
  output: '',
  source: ['.'],
  repo: REPO_ROOT,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

const timings: string[] = []

const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = performance.now()
  const result = await fn()
  timings.push(`${label}: ${(performance.now() - start).toFixed(1)}ms`)
  return result
}

const drainLines = async (
  generator: AsyncGenerator<string>
): Promise<string[]> => {
  const lines: string[] = []
  for await (const line of generator) {
    lines.push(line)
  }
  return lines.sort()
}

afterAll(() => {
  GitAdapter.closeAll()
  TsGitAdapter.closeAll()
  process.stderr.write(`\n--- spike timings ---\n${timings.join('\n')}\n`)
})

describe('Given the sfdx-git-delta repository', () => {
  describe('When resolving refs', () => {
    it('Then parseRev matches between backends', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      const expected = await timed('parseRev native', () => native.parseRev(TO))
      const actual = await timed('parseRev tsgit', () => sut.parseRev(TO))

      expect(actual).toBe(expected)
    })

    it('Then getFirstCommitRef matches between backends', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      const expected = await timed('firstCommit native', () =>
        native.getFirstCommitRef()
      )
      const actual = await timed('firstCommit tsgit', () =>
        sut.getFirstCommitRef()
      )

      expect(actual).toBe(expected)
    })
  })

  describe('When building the tree index', () => {
    it('Then getFilesPath returns the same file list', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      await timed('treeIndex native', () => native.preBuildTreeIndex(TO, []))
      await timed('treeIndex tsgit', () => sut.preBuildTreeIndex(TO, []))

      const expected = (await native.getFilesPath('')).sort()
      const actual = (await sut.getFilesPath('')).sort()

      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })

    it('Then listDirAtRevision and pathExists agree', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)
      await native.preBuildTreeIndex(TO, [])
      await sut.preBuildTreeIndex(TO, [])

      expect((await sut.listDirAtRevision('src', TO)).sort()).toEqual(
        (await native.listDirAtRevision('src', TO)).sort()
      )
      expect(await sut.pathExists('src/main.ts')).toBe(
        await native.pathExists('src/main.ts')
      )
      expect(await sut.pathExists('src/nope.ts')).toBe(
        await native.pathExists('src/nope.ts')
      )
    })
  })

  describe('When diffing two commits', () => {
    it('Then streamDiffLines emits the same lines', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      const expected = await timed('diff native', () =>
        drainLines(native.streamDiffLines())
      )
      const actual = await timed('diff tsgit', () =>
        drainLines(sut.streamDiffLines())
      )

      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })

    it('Then ignoreWhitespace drops the same lines', async () => {
      const config = makeConfig({ ignoreWhitespace: true })
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      const expected = await timed('diff -w native', () =>
        drainLines(native.streamDiffLines())
      )
      const actual = await timed('diff -w tsgit', () =>
        drainLines(sut.streamDiffLines())
      )

      expect(actual).toEqual(expected)
    })

    it('Then rename detection emits the same pairs', async () => {
      const config = makeConfig({ changesManifest: 'changes.json' })
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      // Normalize rename scores: git emits R<similarity>, tsgit spike R100
      const normalize = (lines: string[]) =>
        lines.map(line => line.replace(/^R\d+\t/, 'R\t')).sort()

      const expected = normalize(
        await timed('diff -M native', () =>
          drainLines(native.streamDiffLines())
        )
      )
      const actual = normalize(
        await timed('diff -M tsgit', () => drainLines(sut.streamDiffLines()))
      )

      expect(actual).toEqual(expected)
    })
  })

  describe('When reading blobs', () => {
    it('Then getBufferContent returns identical bytes', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)
      await sut.preBuildTreeIndex(TO, [])
      const samples = (await sut.getFilesPath('src')).slice(0, 25)
      expect(samples.length).toBeGreaterThan(0)

      const expected = await timed('blobs native', () =>
        Promise.all(
          samples.map(path => native.getBufferContent({ path, oid: TO }))
        )
      )
      const actual = await timed('blobs tsgit', () =>
        Promise.all(
          samples.map(path => sut.getBufferContent({ path, oid: TO }))
        )
      )

      actual.forEach((buffer, i) => {
        expect(buffer.equals(expected[i])).toBe(true)
      })
    })

    it('Then streamContent forwards the same bytes', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)
      const forRef = { path: 'package.json', oid: TO }

      const read = async (stream: NodeJS.ReadableStream) => {
        const chunks: Buffer[] = []
        for await (const chunk of stream) {
          chunks.push(chunk as Buffer)
        }
        return Buffer.concat(chunks)
      }

      const expected = await read(native.streamContent(forRef))
      const actual = await read(sut.streamContent(forRef))

      expect(actual.equals(expected)).toBe(true)
    })
  })

  describe('When streaming a directory archive', () => {
    it('Then both backends yield the same entries and bytes', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      const collect = async (
        iterator: AsyncIterable<{
          path: string
          stream: NodeJS.ReadableStream
        }>
      ) => {
        const entries = new Map<string, number>()
        for await (const { path, stream } of iterator) {
          let size = 0
          for await (const chunk of stream) {
            size += (chunk as Buffer).length
          }
          entries.set(path, size)
        }
        return entries
      }

      const expected = await timed('archive native', () =>
        collect(native.streamArchive('src/utils', TO))
      )
      const actual = await timed('archive tsgit', () =>
        collect(sut.streamArchive('src/utils', TO))
      )

      expect(actual.size).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })
  })

  describe('When grepping at a revision', () => {
    it('Then both backends find the same files', async () => {
      const config = makeConfig()
      const native = GitAdapter.getInstance(config)
      const sut = TsGitAdapter.getInstance(config)

      const expected = (
        await timed('grep native', () =>
          native.gitGrep('EscalateToStreamingSignal', 'src', TO)
        )
      ).sort()
      const actual = (
        await timed('grep tsgit', () =>
          sut.gitGrep('EscalateToStreamingSignal', 'src', TO)
        )
      ).sort()

      expect(actual.length).toBeGreaterThan(0)
      expect(actual).toEqual(expected)
    })
  })
})
