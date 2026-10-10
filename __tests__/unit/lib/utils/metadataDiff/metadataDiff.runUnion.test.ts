'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDefinition,
  getInFileAttributes,
} from '../../../../../src/metadata/metadataManager'
import type { SharedFileMetadata } from '../../../../../src/types/metadata'
import type { Work } from '../../../../../src/types/work'
import MetadataDiff, {
  type UnionDiffInput,
} from '../../../../../src/utils/metadataDiff/index.js'
import { getWork } from '../../../../__utils__/testWork'

const mockGetStringContent =
  vi.fn<(ref: { path: string; oid: string }) => Promise<string>>()
vi.mock('../../../../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: () => ({ getStringContent: mockGetStringContent }),
  },
}))

const XML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>`
const NAMESPACE = `xmlns="http://soap.sforce.com/2006/04/metadata"`
const FROM = 'from-ref'
const TO = 'to-ref'

const label = (name: string, value = 'v') =>
  `    <labels>\n        <fullName>${name}</fullName>\n        <value>${value}</value>\n    </labels>\n`

const labelsFile = (...labels: string[]) =>
  `${XML_HEADER}\n<CustomLabels ${NAMESPACE}>\n${labels.join('')}</CustomLabels>\n`

const serve = (files: Record<string, string>) => {
  mockGetStringContent.mockImplementation(async ({ path, oid }) => {
    const content = files[`${oid}:${path}`]
    if (content === undefined) throw new Error(`no ${oid}:${path}`)
    return content
  })
}

const input = (overrides: Partial<UnionDiffInput> = {}): UnionDiffInput => ({
  additionBasePaths: ['base.xml'],
  deletionBasePaths: ['base.xml'],
  shieldPaths: ['member.xml'],
  memberPaths: ['member.xml'],
  ...overrides,
})

describe('MetadataDiff.runUnion', () => {
  let inFileAttributes: Map<string, SharedFileMetadata>
  let work: Work

  beforeAll(async () => {
    const metadata = await getDefinition({})
    inFileAttributes = getInFileAttributes(metadata)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    work = getWork()
    work.config.from = FROM
    work.config.to = TO
    work.config.generateDelta = true
  })

  it('Given one base file and one shield member holding the same labels, When runUnion runs, Then the member outcome has no entry and no writer', async () => {
    // Arrange
    const xml = labelsFile(label('A1'), label('A2'))
    serve({ [`${FROM}:base.xml`]: xml, [`${TO}:member.xml`]: xml })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(input())

    // Assert
    const outcome = result.get('member.xml')
    expect(outcome?.manifests.added).toEqual([])
    expect(outcome?.manifests.modified).toEqual([])
    expect(outcome?.manifests.deleted).toEqual([])
    expect(outcome?.writer).toBeUndefined()
  })

  it('Given a label in the deletion base and in no shield file, When runUnion runs, Then every member reports it deleted', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1'), label('Gone')),
      [`${TO}:m1.xml`]: labelsFile(label('A1')),
      [`${TO}:m2.xml`]: labelsFile(label('A1')),
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(
      input({
        shieldPaths: ['m1.xml', 'm2.xml'],
        memberPaths: ['m1.xml', 'm2.xml'],
      })
    )

    // Assert
    const expected = [{ type: 'CustomLabel', member: 'Gone' }]
    expect(result.get('m1.xml')?.manifests.deleted).toEqual(expected)
    expect(result.get('m2.xml')?.manifests.deleted).toEqual(expected)
  })

  it('Given a label held by another shield file, When runUnion runs, Then it is not deleted', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1'), label('Moved')),
      [`${TO}:m1.xml`]: labelsFile(label('A1')),
      [`${TO}:m2.xml`]: labelsFile(label('Moved')),
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(
      input({
        shieldPaths: ['m1.xml', 'm2.xml'],
        memberPaths: ['m1.xml', 'm2.xml'],
      })
    )

    // Assert
    expect(result.get('m1.xml')?.manifests.deleted).toEqual([])
    expect(result.get('m2.xml')?.manifests.deleted).toEqual([])
  })

  it('Given a label only in an addition-base file outside the deletion base and in no shield file, When runUnion runs, Then it is not deleted', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1')),
      [`${FROM}:extra.xml`]: labelsFile(label('Extra')),
      [`${TO}:member.xml`]: labelsFile(label('A1')),
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(
      input({
        additionBasePaths: ['base.xml', 'extra.xml'],
        deletionBasePaths: ['base.xml'],
      })
    )

    // Assert
    expect(result.get('member.xml')?.manifests.deleted).toEqual([])
  })

  it('Given the same label in two base files with different values and reads completing in reverse path order, When runUnion runs, Then the replay follows sorted path order', async () => {
    // Arrange
    const files: Record<string, string> = {
      [`${FROM}:a.xml`]: labelsFile(label('X', 'one')),
      [`${FROM}:b.xml`]: labelsFile(label('X', 'two')),
      [`${TO}:member.xml`]: labelsFile(label('X', 'two')),
    }
    mockGetStringContent.mockImplementation(async ({ path, oid }) => {
      if (path === 'a.xml') await new Promise(r => setTimeout(r, 20))
      return files[`${oid}:${path}`] ?? ''
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(
      input({
        additionBasePaths: ['b.xml', 'a.xml'],
        deletionBasePaths: ['b.xml', 'a.xml'],
      })
    )

    // Assert
    expect(result.get('member.xml')?.manifests.modified).toEqual([])
  })

  it('Given base and shield files, When runUnion runs, Then every base file is read once at from and every shield file once at to', async () => {
    // Arrange
    const xml = labelsFile(label('A1'))
    serve({
      [`${FROM}:base.xml`]: xml,
      [`${FROM}:base2.xml`]: xml,
      [`${TO}:m1.xml`]: xml,
      [`${TO}:m2.xml`]: xml,
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    await sut.runUnion(
      input({
        additionBasePaths: ['base.xml', 'base2.xml'],
        deletionBasePaths: ['base.xml'],
        shieldPaths: ['m1.xml', 'm2.xml'],
        memberPaths: ['m1.xml'],
      })
    )

    // Assert
    const calls = mockGetStringContent.mock.calls.map(([ref]) => ref)
    expect(calls).toHaveLength(4)
    expect(calls).toEqual(
      expect.arrayContaining([
        { path: 'base.xml', oid: FROM },
        { path: 'base2.xml', oid: FROM },
        { path: 'm1.xml', oid: TO },
        { path: 'm2.xml', oid: TO },
      ])
    )
  })

  it('Given generateDelta false, When runUnion runs, Then no member has a writer', async () => {
    // Arrange
    work.config.generateDelta = false
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1', 'old')),
      [`${TO}:member.xml`]: labelsFile(label('A1', 'new')),
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(input())

    // Assert
    expect(result.get('member.xml')?.manifests.modified).toHaveLength(1)
    expect(result.get('member.xml')?.writer).toBeUndefined()
  })

  it('Given a member with a change and generateDelta true, When runUnion runs, Then the member has a writer and a non-member shield file has no outcome entry', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1', 'old')),
      [`${TO}:member.xml`]: labelsFile(label('A1', 'new')),
      [`${TO}:shield.xml`]: labelsFile(label('A1', 'old')),
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(
      input({ shieldPaths: ['member.xml', 'shield.xml'] })
    )

    // Assert
    expect(result.get('member.xml')?.writer).toBeDefined()
    expect(result.has('shield.xml')).toBe(false)
  })

  it('Given an empty shield file at to, When runUnion runs, Then it contributes no to-elements', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1')),
      [`${TO}:member.xml`]: '',
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(input())

    // Assert
    expect(result.get('member.xml')?.manifests.deleted).toEqual([
      { type: 'CustomLabel', member: 'A1' },
    ])
    expect(result.get('member.xml')?.manifests.added).toEqual([])
  })

  it('Given a malformed base file, When runUnion runs, Then its elements are skipped and runUnion resolves', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: '<CustomLabels></></CustomLabels>',
      [`${TO}:member.xml`]: labelsFile(label('A1')),
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const result = await sut.runUnion(input())

    // Assert
    expect(result.get('member.xml')?.manifests.deleted).toEqual([])
  })

  it('Given a malformed shield file, When runUnion runs, Then it rejects', async () => {
    // Arrange
    serve({
      [`${FROM}:base.xml`]: labelsFile(label('A1')),
      [`${TO}:member.xml`]: '<CustomLabels><labels><fullName>',
    })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const act = sut.runUnion(input())

    // Assert
    await expect(act).rejects.toThrow()
  })

  it('Given a git read failure, When runUnion runs, Then it rejects', async () => {
    // Arrange
    serve({ [`${FROM}:base.xml`]: labelsFile(label('A1')) })
    const sut = new MetadataDiff(work.config, inFileAttributes)

    // Act
    const act = sut.runUnion(input())

    // Assert
    await expect(act).rejects.toThrow('no to-ref:member.xml')
  })
})
