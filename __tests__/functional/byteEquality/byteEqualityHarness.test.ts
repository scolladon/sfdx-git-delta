'use strict'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PassThrough } from 'node:stream'

import { beforeAll, describe, expect, it, vi } from 'vitest'

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
}

const listFixtures = (): Fixture[] => {
  const names = readdirSync(FIXTURES_DIR).filter(name => {
    try {
      readFileSync(join(FIXTURES_DIR, name, 'from.xml'))
      readFileSync(join(FIXTURES_DIR, name, 'to.xml'))
      return true
    } catch {
      return false
    }
  })
  return names.sort().map(name => {
    const expectedPath = join(FIXTURES_DIR, name, 'expected.xml')
    let expected: string | null
    try {
      expected = readFileSync(expectedPath, 'utf8')
    } catch {
      expected = null
    }
    return {
      name,
      fromXml: readFileSync(join(FIXTURES_DIR, name, 'from.xml'), 'utf8'),
      toXml: readFileSync(join(FIXTURES_DIR, name, 'to.xml'), 'utf8'),
      expectedPath,
      expected,
    }
  })
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

  // Snapshots were originally produced by the legacy compare+prune pipeline
  // (P3.5). After P4b.2 deleted legacy, run()'s writer output matching the
  // committed snapshot IS the parity assertion. Regenerate with the
  // UPDATE_BYTE_EQUALITY_SNAPSHOTS=1 env var if the pipeline intentionally
  // changes output format.
  it.each(
    fixtures
  )('Given fixture $name, When streaming run() executes, Then the writer output matches the committed snapshot', async (fixture: Fixture) => {
    // Arrange
    mockedReadPathFromGit.mockImplementation(async ref =>
      ref.oid === work.config.to ? fixture.toXml : fixture.fromXml
    )
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const outcome = await sut.run('file/path')
    if (!outcome.writer) {
      // Under generateDelta=true (set by getWork()), writer-absent means
      // no add/modify content was retained for the to-side (only deletes
      // or no real change at all). Either way, the manifest's package
      // side must be empty.
      expect(
        outcome.manifests.added.length + outcome.manifests.modified.length
      ).toBe(0)
      return
    }
    const chunks: Buffer[] = []
    const stream = new PassThrough()
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
    await outcome.writer(stream)
    stream.end()
    const produced = Buffer.concat(chunks).toString('utf8')

    // Assert
    if (UPDATE_SNAPSHOTS) {
      writeFileSync(fixture.expectedPath, produced, 'utf8')
    } else if (fixture.expected === null) {
      throw new Error(
        `Missing snapshot for fixture ${fixture.name} at ${fixture.expectedPath}. Rerun with UPDATE_BYTE_EQUALITY_SNAPSHOTS=1 to create it.`
      )
    }
    const expected = readFileSync(fixture.expectedPath, 'utf8')
    expect(produced).toBe(expected)
  })
})
