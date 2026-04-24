'use strict'
import { PassThrough } from 'node:stream'

import { beforeAll, describe, expect, it } from 'vitest'

import {
  getDefinition,
  getInFileAttributes,
} from '../../../../../src/metadata/metadataManager'
import type { SharedFileMetadata } from '../../../../../src/types/metadata'
import {
  CARDINALITY_SAFETY_LIMIT,
  StreamingDiff,
} from '../../../../../src/utils/metadataDiff/streamingDiff'
import type { RootCapture } from '../../../../../src/utils/metadataDiff/xmlEventReader'

const buildRoot = (): RootCapture => ({
  xmlHeader: undefined,
  rootKey: 'Profile',
  rootAttributes: {},
})

const findPackageableKeyedSubType = (
  attrs: Map<string, SharedFileMetadata>
): { tag: string; xmlName: string } => {
  for (const [tag, attr] of attrs.entries()) {
    if (
      !attr.excluded &&
      attr.key &&
      attr.key !== '<array>' &&
      attr.key !== '<object>' &&
      attr.xmlName
    ) {
      return { tag, xmlName: attr.xmlName }
    }
  }
  throw new Error('No packageable keyed subType found in registry')
}

const drainWriter = async (
  writer: ((out: PassThrough) => Promise<void>) | undefined
): Promise<string> => {
  if (!writer) return ''
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
  await writer(stream)
  stream.end()
  return Buffer.concat(chunks).toString('utf8')
}

describe('StreamingDiff', () => {
  let inFileAttributes: Map<string, SharedFileMetadata>
  beforeAll(async () => {
    const metadata = await getDefinition({})
    inFileAttributes = getInFileAttributes(metadata)
  })

  it('Given identical content, When finalize runs, Then hasAnyChanges is false and writer is undefined', () => {
    // Arrange
    const sut = new StreamingDiff(inFileAttributes, true)
    const element = {
      field: 'Account.Name',
      editable: 'true',
      readable: 'true',
    }
    sut.onFromElement('fieldPermissions', element)
    sut.onToElement('fieldPermissions', element)

    // Act
    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert
    expect(outcome.hasAnyChanges).toBe(false)
    expect(outcome.added).toHaveLength(0)
    expect(outcome.modified).toHaveLength(0)
    expect(outcome.deleted).toHaveLength(0)
    expect(writer).toBeUndefined()
  })

  it('Given a new keyed element in to (packageable), When finalize runs, Then added carries the member and the writer includes it', async () => {
    // Arrange - use a packageable InFile subType
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    const newElement = { [keyField]: 'New.Member' }
    sut.onToElement(packageableSubType.tag, newElement)

    // Act
    const outcome = sut.finalize()
    const produced = await drainWriter(sut.buildWriter(buildRoot()))

    // Assert
    expect(outcome.added).toEqual([
      { type: packageableSubType.xmlName, member: 'New.Member' },
    ])
    expect(outcome.hasAnyChanges).toBe(true)
    expect(produced).toContain('New.Member')
  })

  it('Given a keyed element removed in to (packageable), When finalize runs, Then deleted carries the member', () => {
    // Arrange
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, {
      [keyField]: 'Old.Member',
    })

    // Act
    const outcome = sut.finalize()

    // Assert
    expect(outcome.deleted).toEqual([
      { type: packageableSubType.xmlName, member: 'Old.Member' },
    ])
  })

  it('Given a non-packageable keyed element differs, When finalize runs, Then hasAnyChanges is true without manifest entries', async () => {
    // Arrange - fieldPermissions is keyed but excluded in the registry
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('fieldPermissions', {
      field: 'Account.Name',
      editable: 'false',
      readable: 'true',
    })
    sut.onToElement('fieldPermissions', {
      field: 'Account.Name',
      editable: 'true',
      readable: 'true',
    })

    // Act
    const outcome = sut.finalize()
    const produced = await drainWriter(sut.buildWriter(buildRoot()))

    // Assert
    expect(outcome.modified).toHaveLength(0)
    expect(outcome.hasAnyChanges).toBe(true)
    expect(produced).toContain('<editable>true</editable>')
  })

  it('Given an <array>-keyed subType differs, When finalize runs, Then hasAnyChanges is true and the entire to array is retained', async () => {
    // Arrange
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('loginHours', { mondayStart: '300', mondayEnd: '500' })
    sut.onToElement('loginHours', { mondayStart: '400', mondayEnd: '600' })

    // Act
    const outcome = sut.finalize()
    const produced = await drainWriter(sut.buildWriter(buildRoot()))

    // Assert
    expect(outcome.hasAnyChanges).toBe(true)
    expect(outcome.added).toHaveLength(0)
    expect(outcome.modified).toHaveLength(0)
    expect(produced).toContain('<mondayStart>400</mondayStart>')
  })

  it('Given an <object>-keyed subType has a new element, When finalize runs, Then only the new element is retained', async () => {
    // Arrange
    const sut = new StreamingDiff(inFileAttributes, true)
    const existing = { layout: 'Existing' }
    const addition = { layout: 'New' }
    sut.onFromElement('layoutAssignments', existing)
    sut.onToElement('layoutAssignments', existing)
    sut.onToElement('layoutAssignments', addition)

    // Act
    const outcome = sut.finalize()
    const produced = await drainWriter(sut.buildWriter(buildRoot()))

    // Assert
    expect(outcome.hasAnyChanges).toBe(true)
    expect(produced).toContain('<layout>New</layout>')
    expect(produced).not.toContain('<layout>Existing</layout>')
  })

  it('Given generateDelta is false, When writer is built, Then it is undefined even with changes', () => {
    // Arrange
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('fieldPermissions', {
      field: 'Account.Name',
      editable: 'true',
      readable: 'true',
    })

    // Act
    sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert
    expect(writer).toBeUndefined()
  })

  it('Given a keyed bucket exceeds CARDINALITY_SAFETY_LIMIT, When onFromElement runs, Then it throws', () => {
    // Arrange
    const sut = new StreamingDiff(inFileAttributes, true)
    // Simulate the bucket being close to the limit via repeated inserts is
    // prohibitively expensive; patch the internal map directly.
    const internalMap = new Map<string, unknown>()
    for (let i = 0; i <= CARDINALITY_SAFETY_LIMIT; i++) {
      internalMap.set(String(i), {})
    }
    ;(
      sut as unknown as {
        passOne: {
          fromKeyed: Map<string, Map<string, unknown>>
        }
      }
    ).passOne.fromKeyed.set(
      'fieldPermissions',
      internalMap as Map<string, unknown>
    )

    // Act & Assert
    expect(() =>
      sut.onFromElement('fieldPermissions', {
        field: 'Account.Overflow',
        editable: 'true',
        readable: 'true',
      })
    ).toThrow(/cardinality safety limit exceeded/)
  })
})
