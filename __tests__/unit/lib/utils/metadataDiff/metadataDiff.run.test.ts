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
    await expect(sut.run('file/path')).rejects.toThrow()
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
})
