'use strict'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  getDefinition,
  getInFileAttributes,
} from '../../../src/metadata/metadataManager'
import type { SharedFileMetadata } from '../../../src/types/metadata'
import type { Work } from '../../../src/types/work'
import { readPathFromGit } from '../../../src/utils/fsHelper'
import MetadataDiff from '../../../src/utils/metadataDiff/index.js'
import { getWork } from '../../__utils__/testWork'

vi.mock('../../../src/utils/fsHelper', async () => {
  const actual: typeof import('../../../src/utils/fsHelper') =
    await vi.importActual('../../../src/utils/fsHelper')
  return {
    ...actual,
    readPathFromGit: vi.fn(),
  }
})

const mockedReadPathFromGit = vi.mocked(readPathFromGit)

const FIXTURES_DIR = resolve(__dirname, 'fixtures')
const UPDATE_SNAPSHOTS = process.env['UPDATE_BYTE_EQUALITY_SNAPSHOTS'] === '1'

type Fixture = {
  name: string
  fromXml: string
  toXml: string
  expectedPath: string
  expected: string | null
  expectationPath: string
  expectationSource: string | null
}

// Absence is the only legitimate read failure: a sidecar or snapshot that
// exists but cannot be read must surface, not masquerade as missing.
const readOrNull = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

// Every directory under fixtures/ is a fixture: a missing from.xml or
// to.xml throws at collection instead of silently dropping the fixture,
// matching the sidecar's hard-fail contract.
const listFixtures = (): Fixture[] =>
  readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map(name => {
      const expectedPath = join(FIXTURES_DIR, name, 'expected.xml')
      const expectationPath = join(FIXTURES_DIR, name, 'expected.json')
      return {
        name,
        fromXml: readFileSync(join(FIXTURES_DIR, name, 'from.xml'), 'utf8'),
        toXml: readFileSync(join(FIXTURES_DIR, name, 'to.xml'), 'utf8'),
        expectedPath,
        expected: readOrNull(expectedPath),
        expectationPath,
        expectationSource: readOrNull(expectationPath),
      }
    })

// The sidecar is a trust boundary: validate its shape rather than cast the
// parsed JSON onto it, so a malformed file fails its own fixture with a
// pointed message instead of surfacing as a confusing assertion mismatch.
const compareEntrySchema = z.object({
  type: z.string(),
  member: z.string(),
})

const fixtureExpectationSchema = z.object({
  hasPackageContent: z.boolean(),
  added: z.array(compareEntrySchema),
  modified: z.array(compareEntrySchema),
  deleted: z.array(compareEntrySchema),
})

type FixtureExpectation = z.infer<typeof fixtureExpectationSchema>

const parseExpectation = (
  fixture: Pick<Fixture, 'name' | 'expectationPath' | 'expectationSource'>
): FixtureExpectation => {
  if (fixture.expectationSource === null) {
    throw new Error(
      `Missing expectation sidecar for fixture ${fixture.name} at ${fixture.expectationPath}`
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(fixture.expectationSource)
  } catch (error) {
    throw new Error(
      `Unparseable expectation sidecar for fixture ${fixture.name} at ${fixture.expectationPath}: ${(error as Error).message}`
    )
  }
  const result = fixtureExpectationSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `Invalid expectation sidecar for fixture ${fixture.name} at ${fixture.expectationPath}: ${result.error.message}`
    )
  }
  return result.data
}

describe('byteEqualityHarness — legacy snapshot parity', () => {
  let inFileAttributes: Map<string, SharedFileMetadata>
  let work: Work

  beforeAll(async () => {
    const globalMetadata = await getDefinition({})
    work = getWork()
    work.config.to = 'to-ref'
    work.config.from = 'from-ref'
    inFileAttributes = getInFileAttributes(globalMetadata)
  })

  const fixtures = listFixtures()

  const stubGitContent = (fixture: Fixture) =>
    mockedReadPathFromGit.mockImplementation(async ref =>
      ref.oid === work.config.to ? fixture.toXml : fixture.fromXml
    )

  // Snapshots originated from the legacy compare+prune pipeline; run()'s
  // writer output matching the committed snapshot IS the parity assertion.
  // Regenerate with the UPDATE_BYTE_EQUALITY_SNAPSHOTS=1 env var if the
  // pipeline intentionally changes output format. Each fixture also
  // declares its expected hasPackageContent flag and manifest entries in a
  // hand-authored expected.json sidecar (see parseExpectation above), which
  // the snapshot alone cannot catch a regression in.
  it.each(fixtures)(
    'Given fixture $name, When streaming run() executes, Then hasPackageContent, manifests and file presence match the fixture expectation',
    async (fixture: Fixture) => {
      // Arrange
      stubGitContent(fixture)
      const expectation = parseExpectation(fixture)
      const sut = new MetadataDiff(work.config, inFileAttributes)

      // Act
      const outcome = await sut.run('file/path')

      // Assert
      expect(outcome.hasPackageContent).toBe(expectation.hasPackageContent)
      expect(outcome.manifests.added).toEqual(expectation.added)
      expect(outcome.manifests.modified).toEqual(expectation.modified)
      expect(outcome.manifests.deleted).toEqual(expectation.deleted)

      if (outcome.writer) {
        const chunks: Buffer[] = []
        const stream = new PassThrough()
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
        await outcome.writer(stream)
        stream.end()
        const produced = Buffer.concat(chunks).toString('utf8')

        if (UPDATE_SNAPSHOTS) {
          writeFileSync(fixture.expectedPath, produced, 'utf8')
        } else if (fixture.expected === null) {
          throw new Error(
            `Writer fired but no snapshot is committed for fixture ${fixture.name} at ${fixture.expectedPath}. Rerun with UPDATE_BYTE_EQUALITY_SNAPSHOTS=1 to create it.`
          )
        } else {
          expect(produced).toBe(fixture.expected)
        }
      } else if (fixture.expected !== null) {
        throw new Error(
          `Snapshot is committed but no writer fires for fixture ${fixture.name} at ${fixture.expectedPath}. Delete the stale snapshot.`
        )
      }
    }
  )

  it.each(fixtures)(
    'Given fixture $name, When run() executes with generateDelta false, Then hasPackageContent and manifests are unchanged and no writer is produced',
    async (fixture: Fixture) => {
      // Arrange
      stubGitContent(fixture)
      const expectation = parseExpectation(fixture)
      const sut = new MetadataDiff(
        { ...work.config, generateDelta: false },
        inFileAttributes
      )

      // Act
      const outcome = await sut.run('file/path')

      // Assert
      expect(outcome.hasPackageContent).toBe(expectation.hasPackageContent)
      expect(outcome.manifests.added).toEqual(expectation.added)
      expect(outcome.manifests.modified).toEqual(expectation.modified)
      expect(outcome.manifests.deleted).toEqual(expectation.deleted)
      expect(outcome.writer).toBeUndefined()
    }
  )
})
