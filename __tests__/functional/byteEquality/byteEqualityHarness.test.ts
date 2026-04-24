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
import { parseXmlFileToJson, xml2Json } from '../../../src/utils/xmlHelper'
import { getWork } from '../../__utils__/testWork'

vi.mock('../../../src/utils/xmlHelper', async () => {
  const actual: typeof import('../../../src/utils/xmlHelper') =
    await vi.importActual('../../../src/utils/xmlHelper')
  return {
    ...actual,
    parseXmlFileToJson: vi.fn(),
  }
})

vi.mock('../../../src/utils/fsHelper', async () => {
  const actual: typeof import('../../../src/utils/fsHelper') =
    await vi.importActual('../../../src/utils/fsHelper')
  return {
    ...actual,
    readPathFromGit: vi.fn(),
  }
})

const mockedParseXmlFileToJson = vi.mocked(parseXmlFileToJson)
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

  it.each(
    fixtures
  )('Given fixture $name, When legacy compare+prune runs, Then the produced XML matches the committed snapshot', async (fixture: Fixture) => {
    // Arrange
    const fromContent = xml2Json(fixture.fromXml)
    const toContent = xml2Json(fixture.toXml)
    mockedParseXmlFileToJson.mockImplementation(
      async (ref): Promise<ReturnType<typeof xml2Json>> => {
        if (ref.oid === work.config.to) return toContent
        return fromContent
      }
    )
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const compared = await sut.compare('file/path')
    const pruned = sut.prune(compared.toContent, compared.fromContent)
    const produced = pruned.xmlContent

    // Assert
    if (UPDATE_SNAPSHOTS || fixture.expected === null) {
      writeFileSync(fixture.expectedPath, produced, 'utf8')
    }
    const expected = readFileSync(fixture.expectedPath, 'utf8')
    expect(produced).toBe(expected)
  })

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
      // No changes: the legacy pruned XML is just declaration + root tag.
      // Skip comparison because we intentionally omit the writer.
      expect(outcome.hasAnyChanges).toBe(false)
      return
    }
    const chunks: Buffer[] = []
    const stream = new PassThrough()
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
    await outcome.writer(stream)
    stream.end()
    const produced = Buffer.concat(chunks).toString('utf8')

    // Assert — run()'s writer output must equal the committed snapshot
    // (which itself equals legacy output by the earlier it.each).
    const expected = readFileSync(fixture.expectedPath, 'utf8')
    expect(produced).toBe(expected)
  })
})
