'use strict'
import { PassThrough } from 'node:stream'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDefinition,
  getInFileAttributes,
} from '../../../../../src/metadata/metadataManager'
import type { SharedFileMetadata } from '../../../../../src/types/metadata'
import type { Work } from '../../../../../src/types/work'
import { readPathFromGit } from '../../../../../src/utils/fsHelper'
import MetadataDiff from '../../../../../src/utils/metadataDiff/index.js'
import { getWork } from '../../../../__utils__/testWork'

vi.mock('../../../../../src/utils/fsHelper', async () => {
  const actual: typeof import('../../../../../src/utils/fsHelper') =
    await vi.importActual('../../../../../src/utils/fsHelper')
  return {
    ...actual,
    readPathFromGit: vi.fn(),
  }
})

const mockedReadPathFromGit = vi.mocked(readPathFromGit)

const XML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>`
const NAMESPACE = `xmlns="http://soap.sforce.com/2006/04/metadata"`

describe('MetadataDiff.run', () => {
  let inFileAttributes: Map<string, SharedFileMetadata>
  let work: Work

  beforeAll(async () => {
    const metadata = await getDefinition({})
    inFileAttributes = getInFileAttributes(metadata)
  })

  beforeEach(() => {
    work = getWork()
    work.config.to = 'to-ref'
    work.config.from = 'from-ref'
    work.config.generateDelta = true
  })

  const serveXml = (from: string, to: string) => {
    mockedReadPathFromGit.mockImplementation(async ref =>
      ref.oid === work.config.to ? to : from
    )
  }

  it('Given identical content, When run runs, Then hasAnyChanges is false and writer is undefined', async () => {
    // Arrange
    const xml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Salesforce</userLicense>\n</Profile>\n`
    serveXml(xml, xml)
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const outcome = await sut.run('file/path')

    // Assert
    expect(outcome.hasAnyChanges).toBe(false)
    expect(outcome.writer).toBeUndefined()
    expect(outcome.manifests.added).toHaveLength(0)
    expect(outcome.manifests.modified).toHaveLength(0)
    expect(outcome.manifests.deleted).toHaveLength(0)
  })

  it('Given a modified Profile, When run runs with generateDelta=true, Then hasAnyChanges is true and writer produces pruned XML', async () => {
    // Arrange
    const fromXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Salesforce</userLicense>\n</Profile>\n`
    const toXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Salesforce Platform</userLicense>\n</Profile>\n`
    serveXml(fromXml, toXml)
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const outcome = await sut.run('file/path')
    expect(outcome.writer).toBeDefined()
    const out = new PassThrough()
    const chunks: Buffer[] = []
    out.on('data', chunk => chunks.push(Buffer.from(chunk)))
    await outcome.writer!(out)
    out.end()
    const produced = Buffer.concat(chunks).toString('utf8')

    // Assert
    expect(outcome.hasAnyChanges).toBe(true)
    expect(produced).toContain('<userLicense>Salesforce Platform</userLicense>')
  })

  it('Given generateDelta is false, When run runs, Then writer is undefined even with changes', async () => {
    // Arrange
    work.config.generateDelta = false
    const fromXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Salesforce</userLicense>\n</Profile>\n`
    const toXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Salesforce Platform</userLicense>\n</Profile>\n`
    serveXml(fromXml, toXml)
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const outcome = await sut.run('file/path')

    // Assert
    expect(outcome.hasAnyChanges).toBe(true)
    expect(outcome.writer).toBeUndefined()
  })

  it('Given the writer is invoked twice, When called again, Then it produces the same bytes (idempotence)', async () => {
    // Arrange
    const fromXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>X</userLicense>\n</Profile>\n`
    const toXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Y</userLicense>\n</Profile>\n`
    serveXml(fromXml, toXml)
    const sut = new MetadataDiff(work.config, inFileAttributes)
    const outcome = await sut.run('file/path')
    expect(outcome.writer).toBeDefined()

    const drain = async () => {
      const out = new PassThrough()
      const chunks: Buffer[] = []
      out.on('data', chunk => chunks.push(Buffer.from(chunk)))
      await outcome.writer!(out)
      out.end()
      return Buffer.concat(chunks).toString('utf8')
    }

    // Act
    const first = await drain()
    const second = await drain()

    // Assert
    expect(second).toBe(first)
  })

  it('Given a malformed to-side XML, When run runs, Then it rejects with a parse error', async () => {
    // Arrange
    serveXml('<Profile></Profile>', '<Profile><unclosed>')
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act & Assert
    await expect(sut.run('file/path')).rejects.toThrow(
      /unclosed|parse|invalid|unexpected/i
    )
  })

  it('Given the from-side file is missing, When run runs, Then it treats it as an addition', async () => {
    // Arrange
    mockedReadPathFromGit.mockImplementation(async ref =>
      ref.oid === work.config.to
        ? `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <userLicense>Salesforce</userLicense>\n</Profile>\n`
        : ''
    )
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const outcome = await sut.run('file/path')

    // Assert
    expect(outcome.hasAnyChanges).toBe(true)
    expect(outcome.writer).toBeDefined()
  })

  it('Given different from and to content, When run runs, Then readPathFromGit is called with correct oids for both sides', async () => {
    // Kills L48 ObjectLiteral {}: mutant replaces {path, oid: config.from} with {},
    // so fromSource would receive toSource content (oid mismatch → same XML returned).
    // Verify from-oid is used correctly: from has element X, to does not → X appears deleted.
    const fromXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <fieldPermissions>\n        <field>Account.FromOnly</field>\n        <editable>true</editable>\n        <readable>true</readable>\n    </fieldPermissions>\n</Profile>\n`
    const toXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <fieldPermissions>\n        <field>Account.ToOnly</field>\n        <editable>true</editable>\n        <readable>true</readable>\n    </fieldPermissions>\n</Profile>\n`

    let fromCallOid: string | undefined
    let toCallOid: string | undefined
    mockedReadPathFromGit.mockImplementation(async ref => {
      if (ref.oid === work.config.to) {
        toCallOid = ref.oid
        return toXml
      }
      fromCallOid = ref.oid
      return fromXml
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    await sut.run('file/path')

    // Assert — both oids must be passed as distinct non-empty values
    expect(toCallOid).toBe(work.config.to)
    expect(fromCallOid).toBe(work.config.from)
    expect(fromCallOid).not.toBe(toCallOid)
  })

  it('Given the to-side is empty (file deleted in to-revision), When run runs, Then the to-side parse is short-circuited and isEmpty is true', async () => {
    // Arrange — empty to-side simulates a file deletion. Legacy
    // parseXmlFileToJson returned `{}` and MetadataComparator emitted
    // every from-side element as deleted; the streaming reader throws
    // on empty input, so MetadataDiff short-circuits the to-side parse
    // when toSource is empty. The from-side is still consumed so
    // drainDeletions can emit packageable subTypes (fieldPermissions
    // is registry-excluded → no manifest entry, but isEmpty=true
    // reflects the empty to-side correctly).
    const fromXml = `${XML_HEADER}\n<Profile ${NAMESPACE}>\n    <fieldPermissions>\n        <field>Account.X</field>\n        <editable>true</editable>\n        <readable>true</readable>\n    </fieldPermissions>\n</Profile>\n`
    mockedReadPathFromGit.mockImplementation(async ref =>
      ref.oid === work.config.to ? '' : fromXml
    )
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const outcome = await sut.run('deleted/path')

    // Assert — the empty-toSource short-circuit returns a well-formed
    // outcome without throwing the parser's "no root element" error.
    expect(outcome.isEmpty).toBe(true)
    expect(outcome.writer).toBeUndefined()
    expect(outcome.manifests.added).toHaveLength(0)
    expect(outcome.manifests.modified).toHaveLength(0)
  })
})
