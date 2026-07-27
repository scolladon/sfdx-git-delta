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

  it('Given identical content, When finalize runs, Then hasPackageContent is false and writer is undefined', () => {
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
    expect(outcome.hasPackageContent).toBe(false)
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
    expect(outcome.hasPackageContent).toBe(true)
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

  it('Given a non-packageable keyed element differs, When finalize runs, Then hasPackageContent is true without manifest entries', async () => {
    // Arrange - fieldPermissions is keyed but excluded in the registry.
    // The retain path still fires (so per-file pruned XML carries the
    // change AND the parent container goes in package.xml — non-packable
    // children are children of a packable file).
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
    expect(outcome.hasPackageContent).toBe(true)
    expect(produced).toContain('<editable>true</editable>')
  })

  it('Given an <array>-keyed subType differs, When finalize runs, Then hasPackageContent is true and the entire to array is retained', async () => {
    // Arrange
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('loginHours', { mondayStart: '300', mondayEnd: '500' })
    sut.onToElement('loginHours', { mondayStart: '400', mondayEnd: '600' })

    // Act
    const outcome = sut.finalize()
    const produced = await drainWriter(sut.buildWriter(buildRoot()))

    // Assert
    expect(outcome.hasPackageContent).toBe(true)
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
    expect(outcome.hasPackageContent).toBe(true)
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
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given unknown-bucket content matches exactly, When finalize runs, Then writer is undefined and hasPackageContent is false', () => {
    // Arrange — identical from and to content in a whole-bucket subType.
    // deepEqual must find no difference so `changed` stays false and
    // neither hasSurvivingChange nor the writer fires.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('description', { text: 'same' })
    sut.onToElement('description', { text: 'same' })

    // Act
    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert
    expect(writer).toBeUndefined()
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given generateDelta is true with an unknown-bucket tag only in from, When finalize runs, Then hasPackageContent stays false and writer is undefined', () => {
    // Arrange — from-only unknown subType. drainWholeBucket iterates the
    // to-side buckets only, so a from-only subType never flips
    // hasSurvivingChange or reaches prunedBySubType.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('description', { text: 'gone' })

    // Act
    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert — the subType vanished, but no prunedBySubType for it and
    // hasSurvivingChange never flips.
    expect(outcome.hasPackageContent).toBe(false)
    expect(writer).toBeUndefined()
  })

  it('Given generateDelta is false with unknown-bucket changes, When finalize runs, Then hasPackageContent is true but writer is undefined', () => {
    // Arrange — toggle generateDelta off. Even without a writer,
    // drainWholeBucket flips hasSurvivingChange when the content changed.
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onFromElement('description', { text: 'old' })
    sut.onToElement('description', { text: 'new' })

    // Act
    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    // Assert — hasPackageContent must NOT depend on generateDelta.
    expect(outcome.hasPackageContent).toBe(true)
    expect(writer).toBeUndefined()
  })

  it('Given object-keyed subType fully matches (retained empty), When finalize runs, Then hasPackageContent stays false', () => {
    // Arrange — all to elements match from fingerprints, so retained is empty.
    const sut = new StreamingDiff(inFileAttributes, true)
    const existing = { layout: 'Account-Layout' }
    sut.onFromElement('layoutAssignments', existing)
    sut.onToElement('layoutAssignments', existing)

    // Act
    const outcome = sut.finalize()

    // Assert — `retained.length > 0` guard must be the `>` branch, not `>=`
    expect(outcome.hasPackageContent).toBe(false)
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

  it('Given an unknown bucket reaches CARDINALITY_SAFETY_LIMIT + 1 via the public API, When onFromElement runs, Then it throws', () => {
    // Arrange — description is not in the registry, so it routes to the
    // unknown bucket. Feeding LIMIT+1 elements via the real public
    // surface exercises the bounded append path without poking private
    // Maps.
    const sut = new StreamingDiff(inFileAttributes, true)

    // Act & Assert
    expect(() => {
      for (let i = 0; i <= CARDINALITY_SAFETY_LIMIT; i++) {
        sut.onFromElement('description', { text: `entry-${i}` })
      }
    }).toThrow(/cardinality safety limit exceeded/)
  })

  it('Given exactly CARDINALITY_SAFETY_LIMIT elements, When onFromElement runs, Then it does not throw', () => {
    // Kills guardCardinality EqualityOperator: `size >= CARDINALITY_SAFETY_LIMIT` would throw at the limit
    const sut = new StreamingDiff(inFileAttributes, true)
    expect(() => {
      for (let i = 0; i < CARDINALITY_SAFETY_LIMIT; i++) {
        sut.onFromElement('description', { text: `entry-${i}` })
      }
    }).not.toThrow()
  })

  it('Given two subTypes in to, When writer runs, Then document order matches to-side insertion order', async () => {
    // Kills toSubTypeOrder ArrayDeclaration: it must start empty so ordering is by arrival
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    // Emit description (unknown bucket) first, then keyed subType
    sut.onToElement('description', { text: 'first' })
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Member.A' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    const descIdx = out.indexOf('<description>')
    const keyedIdx = out.indexOf(`<${packageableSubType.tag}>`)
    expect(descIdx).toBeGreaterThan(0)
    expect(keyedIdx).toBeGreaterThan(descIdx)
  })

  it('Given a subType present in from with no matching to entry (unknown subType), When finalize runs, Then hasPackageContent stays false', () => {
    // Kills onFromElement's unknown-bucket routing mutants.
    // drainWholeBucket only iterates the to-side buckets, so a from-only
    // unknown subType never flips hasSurvivingChange.
    const sut = new StreamingDiff(inFileAttributes, false)
    // 'unknownSubType' is not in the attributes map
    sut.onFromElement('unknownSubType', { value: 'x' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given same unknown subType in from and to, When finalize runs, Then writer is undefined and hasPackageContent is false', async () => {
    // Kills drainWholeBucket's changed-detection on the unknown bucket.
    // Unchanged content with non-empty toArr must not keep the parent in
    // package.xml — nothing actually changed, so neither the internal
    // flag nor the writer fires.
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { value: 'same' }
    sut.onFromElement('unknownSubType', elem)
    sut.onToElement('unknownSubType', elem)
    const outcome = sut.finalize()
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given unknown subType only in to, When finalize runs with generateDelta, Then prunedBySubType retains it', async () => {
    // Kills drainWholeBucket's generateDelta retention-guard mutants (unknown bucket)
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('unknownSubType', { value: 'new' })
    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(outcome.hasPackageContent).toBe(true)
    expect(out).toContain('<unknownSubType>')
  })

  it('Given unknown subType only in to with generateDelta false, When finalize runs, Then hasPackageContent is true but no writer', async () => {
    // Kills drainWholeBucket's generateDelta=false retention branch (unknown bucket)
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('unknownSubType', { value: 'new' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given unknown subType only in to (no from), When finalize runs, Then hasPackageContent is true (absent from-bucket counts as changed)', () => {
    // Kills drainWholeBucket changed-detection: an absent from bucket
    // never deep-equals a non-empty to bucket, so changed must be true
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('description', { text: 'only-to' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(true)
  })

  it('Given unknown subType with change, When generateDelta true, Then retained in writer output', async () => {
    // Kills drainWholeBucket's retention-guard mutants (unknown bucket)
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('description', { text: 'old' })
    sut.onToElement('description', { text: 'new' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(out).toContain('<description>')
  })

  it('Given array subType with same content, When finalize runs, Then hasPackageContent stays false', () => {
    // Kills drainArrays' deepEqual guard true-branch
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { mondayStart: '300', mondayEnd: '500' }
    sut.onFromElement('loginHours', elem)
    sut.onToElement('loginHours', elem)
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given array subType only in to with generateDelta true, When finalize runs, Then it is retained in writer', async () => {
    // Kills drainArrays' `fromArr ?? []` ArrayDeclaration and its generateDelta retention guard
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('loginHours', { mondayStart: '400', mondayEnd: '600' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(out).toContain('<loginHours>')
  })

  it('Given array subType differs with generateDelta false, When finalize runs, Then hasPackageContent is true but no writer', () => {
    // Kills drainArrays' generateDelta=false retention branch.
    // Also locks the regression for the array-bucket path:
    // hasPackageContent must flip even when no per-file writer is produced.
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onFromElement('loginHours', { mondayStart: '300' })
    sut.onToElement('loginHours', { mondayStart: '400' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given a keyed element replaced by another key (a delete beside an add), When finalize runs, Then both manifests carry their member, hasPackageContent is true and the writer fires', () => {
    // Kills classifyKeyedElement's fromMap===undefined || fromElem===undefined
    // LogicalOperator (→ &&). Also pins the mixed contract: a deletion
    // beside a surviving change must NOT suppress the container entry or
    // the writer — only delete-ONLY diffs do that.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Existing.Key' })
    // to has a different key → fromMap exists, fromElem is undefined
    sut.onToElement(packageableSubType.tag, { [keyField]: 'New.Key' })
    const outcome = sut.finalize()
    expect(outcome.added).toEqual([
      { type: packageableSubType.xmlName, member: 'New.Key' },
    ])
    expect(outcome.deleted).toEqual([
      { type: packageableSubType.xmlName, member: 'Existing.Key' },
    ])
    expect(outcome.hasPackageContent).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeDefined()
  })

  it('Given a packageable keyed element is modified, When finalize runs, Then modified carries the member', () => {
    // Kills the isPackageable guards in recordAdded/recordModified
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
    // Kills retainSubTypeElement's generateDelta=false guard
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, false)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'New.Key' })
    sut.finalize()
    // generateDelta=false → buildWriter always returns undefined
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given buildWriter is called with null rootCapture, When called, Then it returns undefined', () => {
    // Kills buildWriter's rootCapture null check
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'A.Key' })
    sut.finalize()
    expect(sut.buildWriter(null)).toBeUndefined()
  })

  it('Given collectRootChildren has subType with elements=[] (empty array via reference), When buildWriter runs, Then empty subType is skipped', async () => {
    // Kills collectRootChildren's `!elements || elements.length === 0` LogicalOperator (→ &&)
    // When elements is an empty array, !elements is false but elements.length===0 is true
    // The || version correctly skips it; the && mutant would include empty arrays
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    // Add one subType to force hasPackageContent and create writer
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Key.A' })
    // Also emit a second subType to to-order but give it no to-elements
    // (will not appear in prunedBySubType since no retain was called)
    sut.onFromElement('description', { text: 'only-from' })
    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(outcome.hasPackageContent).toBe(true)
    // 'description' had no to-elements so must not appear in output
    expect(out).not.toContain('<description>')
    expect(out).toContain(`<${packageableSubType.tag}>`)
  })

  it('Given a delete-only diff, When finalize runs, Then the deletion is recorded, hasPackageContent stays false, and no writer is produced', () => {
    // A delete-only file must not flip hasSurvivingChange: the deletion
    // is recorded, but the parent stays out of package.xml and no writer
    // fires since nothing deployable remains.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Del.Key' })
    // No to-element → stays in fromKeyed → drainDeletions fires
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(false)
    expect(outcome.deleted).toHaveLength(1)
    expect(outcome.deleted[0].member).toBe('Del.Key')
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given drainDeletions subType has size > 0 but remaining.size is exactly 0, When finalize runs, Then no deletion recorded', () => {
    // Kills drainDeletions' `remaining.size === 0` continue guard
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

  it('Given object-keyed subType has new element with generateDelta false, When finalize runs, Then hasPackageContent is true but writer undefined', () => {
    // Kills drainObjectFingerprints' generateDelta retention guard.
    // Also locks the regression for the object-bucket path.
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('layoutAssignments', { layout: 'New' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  // --- drainWholeBucket, keyless bucket (valueTranslation is the only registry keyless subType) ---

  it('Given real keyless subType with identical from and to content, When finalize runs, Then writer is undefined and hasPackageContent is false (drainWholeBucket changed=false)', () => {
    // Kills drainWholeBucket changed-detection on the keyless bucket:
    // deepEqual content must leave changed false, so neither
    // hasSurvivingChange nor the writer fires.
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { fullName: 'salesforce' }
    sut.onFromElement('valueTranslation', elem)
    sut.onToElement('valueTranslation', elem)

    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    expect(writer).toBeUndefined()
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given real keyless subType only in to with generateDelta true, When finalize runs, Then it is retained in writer (drainWholeBucket retain path)', async () => {
    // Kills drainWholeBucket changed-detection (absent from bucket counts
    // as changed) and its generateDelta retention guard (keyless bucket)
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('valueTranslation', { fullName: 'new-value' })

    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))

    expect(outcome.hasPackageContent).toBe(true)
    expect(out).toContain('<valueTranslation>')
  })

  it('Given real keyless subType with changed content, When finalize runs, Then hasPackageContent is true and the writer produces the new content (drainWholeBucket deepEqual false path)', async () => {
    // Kills drainWholeBucket's !deepEqual arm on the keyless bucket —
    // the deepEqual result alone drives changed.
    // The produced-output assertion kills the changed-condition mutants too:
    // when changed mutates to false, hasSurvivingChange stays false and
    // the writer short-circuits, leaving produced empty.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('valueTranslation', { fullName: 'old' })
    sut.onToElement('valueTranslation', { fullName: 'new' })

    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))

    expect(outcome.hasPackageContent).toBe(true)
    expect(out).toContain('<valueTranslation>')
    expect(out).toContain('<fullName>new</fullName>')
  })

  it('Given real keyless subType only in to with generateDelta false, When finalize runs, Then hasPackageContent is true but writer is undefined', () => {
    // Kills drainWholeBucket's generateDelta=false retention branch (keyless bucket)
    const sut = new StreamingDiff(inFileAttributes, false)
    sut.onToElement('valueTranslation', { fullName: 'new-value' })

    const outcome = sut.finalize()

    expect(outcome.hasPackageContent).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  // --- drainWholeBucket, unknown bucket (tags absent from inFileAttributes) ---

  it('Given an unchanged whole-bucket tag beside a genuine keyed add, When the writer renders, Then both the unchanged tag and the added child are retained (whole-bucket retention rides along)', async () => {
    // Proves requirement 4 at unit level: retention of unchanged
    // whole-bucket content is unconditional once the writer fires for an
    // unrelated reason (here, a keyed add) — the unchanged tag must still
    // appear alongside the change that actually triggered the writer.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement('description', { text: 'same' })
    sut.onToElement('description', { text: 'same' })
    sut.onToElement(packageableSubType.tag, { [keyField]: 'New.Key' })

    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))

    expect(out).toContain('<description>')
    expect(out).toContain(`<${keyField}>New.Key</${keyField}>`)
  })

  it('Given unknown subType with identical from and to content, When finalize runs, Then writer is undefined and hasPackageContent is false (drainWholeBucket changed=false path)', () => {
    // Kills drainWholeBucket changed-detection on the unknown bucket:
    // deepEqual content leaves changed false → neither
    // hasSurvivingChange nor buildWriter fires.
    const sut = new StreamingDiff(inFileAttributes, true)
    const elem = { value: 'same' }
    sut.onFromElement('unknownSubType', elem)
    sut.onToElement('unknownSubType', elem)

    const outcome = sut.finalize()
    const writer = sut.buildWriter(buildRoot())

    expect(writer).toBeUndefined()
    expect(outcome.hasPackageContent).toBe(false)
  })

  it('Given unknown subType with changed content (from non-empty), When the writer renders, Then the new content appears in output (drainWholeBucket deepEqual false)', async () => {
    // Kills drainWholeBucket's !deepEqual arm on the unknown bucket.
    // The produced-output assertion kills the changed-condition mutants too:
    // when changed mutates to false, hasSurvivingChange stays false and
    // the writer short-circuits, leaving produced empty.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onFromElement('unknownSubType', { value: 'old' })
    sut.onToElement('unknownSubType', { value: 'new' })

    const outcome = sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))

    expect(outcome.hasPackageContent).toBe(true)
    expect(out).toContain('<unknownSubType>')
    expect(out).toContain('<value>new</value>')
  })

  it('Given no surviving change, When buildWriter is called with a valid rootCapture, Then writer is undefined', () => {
    // No surviving change ⇒ no writer, regardless of a valid rootCapture.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    // Same element in from and to → no changes
    const elem = { [keyField]: 'Same.Key' }
    sut.onFromElement(packageableSubType.tag, elem)
    sut.onToElement(packageableSubType.tag, elem)
    sut.finalize()
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given changes and valid rootCapture and generateDelta true, When buildWriter called after finalize, Then writer is defined (not true-mutant)', async () => {
    // Directly tests the non-mutant path: all three conditions true → writer returned.
    // Kills buildWriter's all-conditions-true path (mutant always returns undefined).
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Added.Key' })
    sut.finalize()
    expect(sut.buildWriter(buildRoot())).toBeDefined()
  })

  it('Given a delete-only keyed subType (all from elements removed in to), When buildWriter runs, Then it returns undefined via the surviving-change gate', () => {
    // Arrange — from has a packageable keyed element, to is empty for it.
    // A deletion entry is emitted, but hasPackageContent stays false and
    // the writer is skipped (no surviving change to ship).
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Only.From' })
    const outcome = sut.finalize()

    // Act
    const writer = sut.buildWriter(buildRoot())

    // Assert — change recorded, but writer skipped (no surviving children)
    expect(outcome.deleted.length).toBeGreaterThan(0)
    expect(outcome.hasPackageContent).toBe(false)
    expect(writer).toBeUndefined()
  })

  it('Given two added keyed elements of the same subType, When retainSubTypeElement runs, Then the second push hits the existing-array branch', () => {
    // Kills retainSubTypeElement's existing-array guard: with the mutant, every retain
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

  it('Given an added keyed element retained in the to-side, When finalize runs, Then hasPackageContent is true (kills the always-false mutant)', () => {
    // Counterpart to the delete-only hasPackageContent=false test above.
    // A mutant that always returns false from hasSurvivingChange would
    // wrongly suppress the parent container even when surviving children
    // exist; this assertion catches that by requiring hasPackageContent
    // to be true on a single retained add.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Survivor.Key' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(true)
  })

  // --- regression coverage for generateDelta=false ---

  it('Given generateDelta=false with a packable keyed add, When finalize runs, Then hasPackageContent is true', () => {
    // Engine-level lock: a packable child added to the to-side flips
    // hasPackageContent regardless of generateDelta.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, false)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Survivor.Key' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(true)
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  it('Given generateDelta=false with only a packable delete, When finalize runs, Then hasPackageContent is false', () => {
    // Counterpart: delete-only must NOT force the container in package.xml.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, false)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Gone.Key' })
    const outcome = sut.finalize()
    expect(outcome.hasPackageContent).toBe(false)
    expect(outcome.deleted.length).toBeGreaterThan(0)
  })

  it('Given a packageable keyed deletion beside a byte-identical unknown tag, When finalize runs, Then hasPackageContent is false and buildWriter is undefined', () => {
    // The reported bug in one test: a removed packageable keyed child
    // alongside an unchanged unknown-bucket tag must not keep the parent
    // in package.xml, and must not produce an orphan delta file — even
    // though prunedBySubType is non-empty (the unknown tag is retained
    // unconditionally).
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onFromElement(packageableSubType.tag, { [keyField]: 'Gone.Key' })
    sut.onFromElement('description', { text: 'same' })
    sut.onToElement('description', { text: 'same' })

    const outcome = sut.finalize()

    expect(outcome.hasPackageContent).toBe(false)
    expect(outcome.added).toHaveLength(0)
    expect(outcome.modified).toHaveLength(0)
    expect(outcome.deleted).toEqual([
      { type: packageableSubType.xmlName, member: 'Gone.Key' },
    ])
    expect(sut.buildWriter(buildRoot())).toBeUndefined()
  })

  // --- mutation kills ---

  it('Given the same subType pushed twice via onToElement, When the writer renders, Then each element appears exactly once (kills trackToOrder dedup mutant)', async () => {
    // Without the seenSubTypes guard, toSubTypeOrder gets duplicates and
    // the writer iterates prunedBySubType[tag] twice, emitting each
    // child element a second time.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'A.Key' })
    sut.onToElement(packageableSubType.tag, { [keyField]: 'B.Key' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    const aKeyMatches = out.match(/A\.Key/g)?.length ?? 0
    const bKeyMatches = out.match(/B\.Key/g)?.length ?? 0
    expect(aKeyMatches).toBe(1)
    expect(bKeyMatches).toBe(1)
  })

  it('Given a non-packageable keyed addition, When finalize runs, Then added stays empty (kills recordAdded isPackageable mutant)', () => {
    // fieldPermissions is keyed-but-excluded in the registry. An add must
    // flip hasSurvivingChange (via retainSubTypeElement) but must NOT
    // appear in the manifests.added list.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('fieldPermissions', {
      field: 'Account.NewlyAdded',
      editable: 'true',
      readable: 'true',
    })
    const outcome = sut.finalize()
    expect(outcome.added).toHaveLength(0)
    expect(outcome.hasPackageContent).toBe(true)
  })

  it('Given two added keyed elements of the same subType under generateDelta=true, When buildWriter renders, Then both keys appear and no garbage is injected (kills retainSubTypeElement existing-array mutants)', async () => {
    // Without the existing-array branch, the second retainSubTypeElement
    // call would reset the array (or inject garbage from an
    // ArrayDeclaration mutation), losing the first element or polluting
    // the per-file pruned XML output.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    sut.onToElement(packageableSubType.tag, { [keyField]: 'First.Key' })
    sut.onToElement(packageableSubType.tag, { [keyField]: 'Second.Key' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(out).toContain(`<${keyField}>First.Key</${keyField}>`)
    expect(out).toContain(`<${keyField}>Second.Key</${keyField}>`)
    expect(out).not.toContain('Stryker')
  })

  it('Given two object-keyed elements pushed to the same subType, When the writer renders, Then both fingerprints appear (kills appendObjectFingerprint list-init mutant)', async () => {
    // appendObjectFingerprint's `if (list === undefined)` guard must
    // preserve the existing list across pushes; resetting it would drop
    // the first fingerprint and the writer output would be missing one.
    const sut = new StreamingDiff(inFileAttributes, true)
    sut.onToElement('layoutAssignments', { layout: 'Layout.A' })
    sut.onToElement('layoutAssignments', { layout: 'Layout.B' })
    sut.finalize()
    const out = await drainWriter(sut.buildWriter(buildRoot()))
    expect(out).toContain('<layout>Layout.A</layout>')
    expect(out).toContain('<layout>Layout.B</layout>')
  })

  it('Given a new keyed subType (no from-side at all), When onToElement runs, Then it must record an addition without throwing (kills classifyKeyedElement add-branch mutant)', () => {
    // Pure addition path: passOne.fromKeyed has no entry for the subType,
    // so fromMap === undefined. The `if (fromMap === undefined || ...)`
    // guard must take the true branch; mutating it to false would fall
    // through to `fromMap.delete(key)` and throw on undefined.
    const packageableSubType = findPackageableKeyedSubType(inFileAttributes)
    const sut = new StreamingDiff(inFileAttributes, true)
    const keyField = inFileAttributes.get(packageableSubType.tag)!.key!
    expect(() => {
      sut.onToElement(packageableSubType.tag, { [keyField]: 'BrandNew.Key' })
    }).not.toThrow()
    const outcome = sut.finalize()
    expect(outcome.added).toEqual([
      { type: packageableSubType.xmlName, member: 'BrandNew.Key' },
    ])
  })
})
