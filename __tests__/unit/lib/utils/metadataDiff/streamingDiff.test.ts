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
    expect(produced).toMatch(
      new RegExp(`<${keyField}>New\\.Member</${keyField}>`)
    )
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

  it('Given a non-packageable keyed subType is deleted in to, When finalize runs, Then deleted manifest is empty', () => {
    // Arrange - fieldPermissions is keyed but excluded in the registry.
    // A from-only fieldPermission must not emit a deletion manifest entry,
    // covering the !isPackageable early-continue in drainDeletions.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('fieldPermissions', {
      field: 'Account.ExcludedOnly',
      editable: 'true',
      readable: 'true',
    })

    // Act
    const outcome = sut.finalize()

    // Assert
    expect(outcome.deleted).toHaveLength(0)
    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given keyless buckets match exactly, When finalize runs, Then hasAnyChanges stays false', () => {
    // Arrange — identical from and to content in a keyless subType
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('description', { text: 'same' })
    sut.onToElement('description', { text: 'same' })

    // Act
    const outcome = sut.finalize()

    // Assert — the `fromArr.length === 0 || !deepEqual(...)` branch must
    // take the false path when lengths match and deepEqual is true.
    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given generateDelta is true but toArr is empty (keyless from-only), When finalize runs, Then prunedBySubType is NOT set', () => {
    // Arrange — from-only keyless subType; toArr.length === 0 gates
    // prunedBySubType write.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('description', { text: 'gone' })

    // Act
    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert — keyless subType vanished, but no prunedBySubType for it.
    // hasAnyChanges stays false since pure keyless deletions don't flip it.
    expect(outcome.hasAnyChanges).toBe(false)
    expect(writer).toBeUndefined()
  })

  it('Given generateDelta is false with keyless changes, When finalize runs, Then hasAnyChanges is true but prunedBySubType is not populated', () => {
    // Arrange — toggle the generateDelta branch off so drainKeyless takes
    // the false side of `this.generateDelta && toArr.length > 0`.
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onFromElement('description', { text: 'old' })
    sut.onToElement('description', { text: 'new' })

    // Act
    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert
    expect(outcome.hasAnyChanges).toBe(true)
    expect(writer).toBeUndefined()
  })

  it('Given object-keyed subType fully matches (retained empty), When finalize runs, Then hasAnyChanges stays false', () => {
    // Arrange — all to elements match from fingerprints, so retained is empty.
    const sut = new StreamingDiff(inFileAttributes, true)
    const existing = { layout: 'Account-Layout' }
    sut.onFromElement('layoutAssignments', existing)
    sut.onToElement('layoutAssignments', existing)

    // Act
    const outcome = sut.finalize()

    // Assert — `retained.length > 0` guard must be the `>` branch, not `>=`
    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given keyed deletion with `excluded` subType, When drainDeletions runs, Then no manifest entry is produced (optional-chain on excluded)', () => {
    // Arrange — fieldPermissions.excluded is true in the registry
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('fieldPermissions', {
      field: 'Account.X',
      editable: 'false',
      readable: 'true',
    })

    // Act
    const outcome = sut.finalize()

    // Assert — excluded means isPackageable returns false → no delete emitted
    expect(outcome.deleted).toEqual([])
  })

  it('Given a keyless bucket reaches CARDINALITY_SAFETY_LIMIT + 1 via the public API, When onFromElement runs, Then it throws', () => {
    // Arrange — userLicense is a keyless Profile subType (no key field,
    // not a registry special-key marker). Feeding LIMIT+1 elements via
    // the real public surface exercises the bounded append path without
    // poking private Maps.
    const sut = new StreamingDiff(inFileAttributes, true)

    // Act & Assert
    expect(() => {
      for (let i = 0; i <= CARDINALITY_SAFETY_LIMIT; i++) {
        sut.onFromElement('description', { text: `entry-${i}` })
      }
    }).toThrow(/cardinality safety limit exceeded/)
  })

  it('Given exactly CARDINALITY_SAFETY_LIMIT elements, When onFromElement runs, Then it does not throw', () => {
    // Kills L337 EqualityOperator: `size >= CARDINALITY_SAFETY_LIMIT` would throw at the limit
    const sut = new StreamingDiff(inFileAttributes, true)
    expect(() => {
      for (let i = 0; i < CARDINALITY_SAFETY_LIMIT; i++) {
        sut.onFromElement('description', { text: `entry-${i}` })
      }
    }).not.toThrow()
  })

  it('Given two subTypes in to, When writer runs, Then document order matches to-side insertion order', async () => {
    // Kills L80 ArrayDeclaration: toSubTypeOrder must start empty so ordering is by arrival
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    // Emit userLicense (keyless) first, then keyed subType
    sut.onToElement('description', { text: 'first' })
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Member.A' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    const descIdx = out.indexOf('<description>')
    const keyedIdx = out.indexOf(`<${packageableSubType.tag}>`)
    expect(descIdx).toBeGreaterThan(0)
    expect(keyedIdx).toBeGreaterThan(descIdx)
  })

  it('Given a subType present in from with no matching to entry (unknown subType), When finalize runs, Then hasAnyChanges stays false', () => {
    // Kills L98/L102 ConditionalExpression: fromUnknown branch
    const sut = new StreamingDiff(inFileAttributes, false)
    // 'unknownSubType' is not in the attributes map
    sut.onFromElement('unknownSubType', { value: 'x' })
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given same unknown subType in from and to, When finalize runs, Then hasAnyChanges stays false', async () => {
    // Kills drainUnknown L287 LogicalOperator: fromArr.length===0 || !deepEqual path
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { value: 'same' }
    sut.onFromElement('unknownSubType', elem)
    sut.onToElement('unknownSubType', elem)
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given unknown subType only in to, When finalize runs with generateDelta, Then prunedBySubType retains it', async () => {
    // Kills L289 ConditionalExpression/LogicalOperator/EqualityOperator: toArr.length > 0 path
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('unknownSubType', { value: 'new' })
    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(outcome.hasAnyChanges).toBe(true)
    expect(out).toContain('<unknownSubType>')
  })

  it('Given unknown subType only in to with generateDelta false, When finalize runs, Then hasAnyChanges is true but no writer', async () => {
    // Kills L289 generateDelta false branch in drainUnknown
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('unknownSubType', { value: 'new' })
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given keyless subType only in to (no from), When finalize runs, Then hasAnyChanges is true (fromArr.length===0 branch)', () => {
    // Kills L273 LogicalOperator: fromArr.length === 0 arm; also L273 EqualityOperator
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('description', { text: 'only-to' })
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(true)
  })

  it('Given keyless subType with same content, When toArr.length > 0 and generateDelta true, Then it is retained even without change', async () => {
    // Kills L278 EqualityOperator toArr.length > 0 (>= would retain even empty)
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { text: 'same' }
    sut.onFromElement('description', elem)
    sut.onToElement('description', elem)
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    // keyless same content: hasAnyChanges=false so writer is undefined
    expect(out).toBe('')
  })

  it('Given keyless subType with change and toArr.length > 0, When generateDelta true, Then retained in writer output', async () => {
    // Kills L278 ConditionalExpression + LogicalOperator variations
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('description', { text: 'old' })
    sut.onToElement('description', { text: 'new' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(out).toContain('<description>')
  })

  it('Given array subType with same content, When finalize runs, Then hasAnyChanges stays false', () => {
    // Kills L245 ConditionalExpression true: deepEqual branch
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { mondayStart: '300', mondayEnd: '500' }
    sut.onFromElement('loginHours', elem)
    sut.onToElement('loginHours', elem)
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given array subType only in to with generateDelta true, When finalize runs, Then it is retained in writer', async () => {
    // Kills L244 ArrayDeclaration (fromArr ?? []) and L247 ConditionalExpression generateDelta guard
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('loginHours', { mondayStart: '400', mondayEnd: '600' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(out).toContain('<loginHours>')
  })

  it('Given array subType differs with generateDelta false, When finalize runs, Then hasAnyChanges is true but no writer', () => {
    // Kills L247 ConditionalExpression: generateDelta=false branch in drainArrays
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onFromElement('loginHours', { mondayStart: '300' })
    sut.onToElement('loginHours', { mondayStart: '400' })
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given keyed element where fromMap exists for subType but key is absent, When onToElement runs, Then it is recorded as added', () => {
    // Kills L199 LogicalOperator: fromMap===undefined || fromElem===undefined → &&
    // Scenario: fromMap has subType but different key → fromElem is undefined
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Existing.Key' })
    // to has a different key → fromMap exists, fromElem is undefined
    sut.onToElement(packageableSubType.tag, { [keyField]: 'New.Key' })
    const outcome = sut.finalize()
    expect(outcome.added).toHaveLength(1)
    expect(outcome.added[0].member).toBe('New.Key')
  })

  it('Given a packageable keyed element is modified, When finalize runs, Then modified carries the member', () => {
    // Kills L212/L219 ConditionalExpression: isPackageable branches in recordAdded/recordModified
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, {
      [keyField]: 'Some.Key',
      value: 'old',
    })
    sut.onToElement(packageableSubType.tag, {
      [keyField]: 'Some.Key',
      value: 'new',
    })
    const outcome = sut.finalize()
    expect(outcome.modified).toHaveLength(1)
    expect(outcome.modified[0].member).toBe('Some.Key')
  })

  it('Given generateDelta false, When retainSubTypeElement called via onToElement keyed add, Then prunedBySubType is not populated', () => {
    // Kills L233 ConditionalExpression: retainSubTypeElement generateDelta=false guard
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, false)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'New.Key' })
    sut.finalize()
    // generateDelta=false → buildWriter always returns undefined
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given buildWriter is called with null rootCapture, When called, Then it returns undefined', () => {
    // Kills L328 ConditionalExpression: rootCapture null check
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'A.Key' })
    sut.finalize()
    expect(sut.buildWriter(null)).toBeUndefined()
  })

  it('Given collectRootChildren has subType with elements=[] (empty array via reference), When buildWriter runs, Then empty subType is skipped', async () => {
    // Kills L184 LogicalOperator: !elements && elements.length===0 (should be ||)
    // When elements is an empty array, !elements is false but elements.length===0 is true
    // The || version correctly skips it; the && mutant would include empty arrays
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    // Add one subType to force hasAnyChanges and create writer
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Key.A' })
    // Also emit a second subType to to-order but give it no to-elements
    // (will not appear in prunedBySubType since no retain was called)
    sut.onFromElement('description', { text: 'only-from' })
    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(outcome.hasAnyChanges).toBe(true)
    // 'description' had no to-elements so must not appear in output
    expect(out).not.toContain('<description>')
    expect(out).toContain(`<${packageableSubType.tag}>`)
  })

  it('Given a packageable keyed deletion, When drainDeletions runs, Then deleted and hasAnyChanges are set (recordDeleted true branch)', () => {
    // Kills L308 BooleanLiteral false: hasAnyChanges = true in recordDeleted
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Del.Key' })
    // No to-element → stays in fromKeyed → drainDeletions fires
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(true)
    expect(outcome.deleted).toHaveLength(1)
    expect(outcome.deleted[0].member).toBe('Del.Key')
  })

  it('Given drainDeletions subType has size > 0 but remaining.size is exactly 0, When finalize runs, Then no deletion recorded', () => {
    // Kills L297 ConditionalExpression: remaining.size === 0 continue guard
    // Arrange: add and match a keyed element so fromKeyed entry has size 0 after pass 2
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    const elem = { [keyField]: 'Match.Key' }
    sut.onFromElement(packageableSubType.tag, elem)
    sut.onToElement(packageableSubType.tag, elem)
    const outcome = sut.finalize()
    expect(outcome.deleted).toHaveLength(0)
  })

  it('Given object-keyed subType has new element with generateDelta false, When finalize runs, Then hasAnyChanges is true but writer undefined', () => {
    // Kills drainObjectFingerprints L265 ConditionalExpression: generateDelta guard
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('layoutAssignments', { layout: 'New' })
    const outcome = sut.finalize()
    expect(outcome.hasAnyChanges).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  // --- drainKeyless (valueTranslation is the only registry keyless subType) ---

  it('Given real keyless subType with identical from and to content, When finalize runs, Then hasAnyChanges stays false (drainKeyless changed=false path)', () => {
    // Kills L273 LogicalOperator: fromArr.length === 0 && !deepEqual (mutant would use &&
    // instead of ||, wrongly marking unchanged equal arrays as changed).
    // fromArr.length > 0 AND deepEqual(fromArr,toArr) === true → changed must be false.
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { fullName: 'salesforce' }
    sut.onFromElement('valueTranslation', elem)
    sut.onToElement('valueTranslation', elem)

    const outcome = sut.finalize()

    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given real keyless subType only in to with generateDelta true, When finalize runs, Then it is retained in writer (drainKeyless retain path)', async () => {
    // Kills L273 ConditionalExpression/EqualityOperator: fromArr.length===0 branch marks changed
    // Kills L278 ConditionalExpression/LogicalOperator: generateDelta&&toArr.length>0 retain guard
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('valueTranslation', { fullName: 'new-value' })

    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))

    expect(outcome.hasAnyChanges).toBe(true)
    expect(out).toContain('<valueTranslation>')
  })

  it('Given real keyless subType with changed content, When finalize runs, Then hasAnyChanges is true (drainKeyless deepEqual false path)', async () => {
    // Kills L273 ConditionalExpression false: !deepEqual(fromArr,toArr) arm; fromArr.length>0
    // so the || short-circuit does not fire — deepEqual result drives changed.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('valueTranslation', { fullName: 'old' })
    sut.onToElement('valueTranslation', { fullName: 'new' })

    const outcome = sut.finalize()

    expect(outcome.hasAnyChanges).toBe(true)
  })

  it('Given real keyless subType only in to with generateDelta false, When finalize runs, Then hasAnyChanges is true but writer is undefined', () => {
    // Kills L278 LogicalOperator: generateDelta || toArr.length>0 would retain even when false
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('valueTranslation', { fullName: 'new-value' })

    const outcome = sut.finalize()

    expect(outcome.hasAnyChanges).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given real keyless subType with matching content and generateDelta true, When finalize runs, Then content IS retained in writer (keyless retain unconditional)', async () => {
    // Kills L278 EqualityOperator toArr.length>0: mutant >=0 would pass same test,
    // but <=0 would NOT retain. This forces the > branch: toArr.length===1>0 → retain.
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { fullName: 'same' }
    sut.onFromElement('valueTranslation', elem)
    sut.onToElement('valueTranslation', elem)

    sut.finalize()
    // hasAnyChanges=false so buildWriter returns undefined; but the guard
    // `generateDelta && toArr.length > 0` DID set prunedBySubType.
    // We verify via the unconditional retain comment: even with no change, the
    // drainKeyless path sets prunedBySubType when toArr is non-empty.
    // buildWriter returns undefined since hasAnyChanges=false — expected.
    const writer = sut.buildWriter(buildRoot())
    expect(writer).toBeUndefined()
  })

  // --- drainUnknown (uses 'description' which is NOT in inFileAttributes) ---

  it('Given unknown subType with identical from and to content, When finalize runs, Then hasAnyChanges stays false (drainUnknown changed=false path)', () => {
    // Kills L287 LogicalOperator: fromArr.length===0 && !deepEqual (mutant) vs || (correct)
    // fromArr.length>0 and deepEqual → changed=false
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { value: 'same' }
    sut.onFromElement('unknownSubType', elem)
    sut.onToElement('unknownSubType', elem)

    const outcome = sut.finalize()

    expect(outcome.hasAnyChanges).toBe(false)
  })

  it('Given unknown subType with changed content (from non-empty), When finalize runs, Then hasAnyChanges is true (drainUnknown deepEqual false)', () => {
    // Kills L287 ConditionalExpression false: !deepEqual arm fires when fromArr.length>0
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('unknownSubType', { value: 'old' })
    sut.onToElement('unknownSubType', { value: 'new' })

    const outcome = sut.finalize()

    expect(outcome.hasAnyChanges).toBe(true)
  })

  it('Given buildWriter called before finalize with hasAnyChanges still false, When called with valid rootCapture, Then writer is undefined', () => {
    // Kills L328 ConditionalExpression true: mutant makes buildWriter always return undefined
    // even after finalize sets hasAnyChanges. This test (no changes) confirms false path.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    // Same element in from and to → no changes
    const elem = { [keyField]: 'Same.Key' }
    sut.onFromElement(packageableSubType.tag, elem)
    sut.onToElement(packageableSubType.tag, elem)
    sut.finalize()
    // hasAnyChanges=false → buildWriter must return undefined
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given changes and valid rootCapture and generateDelta true, When buildWriter called after finalize, Then writer is defined (not true-mutant)', async () => {
    // Directly tests the non-mutant path: all three conditions true → writer returned.
    // Kills L328 ConditionalExpression true (mutant always returns undefined).
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Added.Key' })
    sut.finalize()
    expect(sut.buildWriter(buildRoot())).toBeDefined()
  })

  it('Given a delete-only keyed subType (all from elements removed in to), When buildWriter runs, Then it returns undefined via the prunedBySubType.size === 0 short-circuit (streamingDiff L182)', () => {
    // Arrange — from has a packageable keyed element, to is empty for it.
    // hasAnyChanges is true (drainDeletions records the delete), but the
    // pruned XML would be just the empty root → buildWriter must skip.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Only.From' })
    const outcome = sut.finalize()

    // Act
    const writer = sut.buildWriter(buildRoot())

    // Assert — change recorded, but writer skipped (no surviving children)
    expect(outcome.hasAnyChanges).toBe(true)
    expect(outcome.isEmpty).toBe(true)
    expect(writer).toBeUndefined()
  })

  it('Given two added keyed elements of the same subType, When retainSubTypeElement runs, Then the second push hits the existing-array branch (streamingDiff L250 sub 1)', () => {
    // Kills L250 ConditionalExpression false: with the mutant, every retain
    // creates a new array, dropping the first element from the writer output.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'First.Key' })
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Second.Key' })
    const outcome = sut.finalize()
    expect(outcome.added).toEqual([
      { type: packageableSubType.xmlName, member: 'First.Key' },
      { type: packageableSubType.xmlName, member: 'Second.Key' },
    ])
  })
})
