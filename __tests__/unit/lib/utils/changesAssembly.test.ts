'use strict'
import { describe, expect, it } from 'vitest'

import {
  DIGITAL_EXPERIENCE_BUNDLE_TYPE,
  DIGITAL_EXPERIENCE_TYPE,
} from '../../../../src/constant/metadataConstants'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  type GitCopyOperation,
  type ManifestElement,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { RenameTriple } from '../../../../src/utils/changeSet'
import { assembleChanges } from '../../../../src/utils/changesAssembly'
import { makeHandlerResult } from '../../../__utils__/handlerResultView'

const packaged = (type: string, member: string): ManifestElement => ({
  target: ManifestTarget.Package,
  type,
  member,
  changeKind: ChangeKind.Add,
})

const deleted = (type: string, member: string): ManifestElement => ({
  target: ManifestTarget.DestructiveChanges,
  type,
  member,
  changeKind: ChangeKind.Delete,
})

describe('assembleChanges', () => {
  describe('Given the handler pass and the collector pass each emit a warning, and a DigitalExperienceBundle deletion triggers a roll-up warning', () => {
    it('When assembleChanges runs, Then the returned warnings are the combined-result warnings followed by the roll-up warnings', () => {
      // Arrange
      const handlerWarning = new Error('handler warning')
      const collectorWarning = new Error('collector warning')
      const handlerResult = makeHandlerResult({
        manifests: [],
        warnings: [handlerWarning],
      })
      const postResult = makeHandlerResult({
        manifests: [
          {
            target: ManifestTarget.DestructiveChanges,
            type: DIGITAL_EXPERIENCE_BUNDLE_TYPE,
            member: 'site/foo',
            changeKind: ChangeKind.Delete,
          },
        ],
        warnings: [collectorWarning],
      })

      // Act
      const result = assembleChanges(handlerResult, postResult, [])

      // Assert — combined-result warnings (handler then collector, producer
      // order) precede the roll-up warning appended after.
      expect(result.warnings).toEqual([
        handlerWarning,
        collectorWarning,
        expect.objectContaining({
          message: expect.stringContaining('site/foo'),
        }),
      ])
    })
  })

  describe('Given a DigitalExperience member covered by a same-target DigitalExperienceBundle member', () => {
    it('When assembleChanges runs, Then the returned changes drop the covered member and keep the survivor', () => {
      // Arrange
      // The bundle comes from the handler pass and the member it covers from
      // the collector pass, so the filter only drops it if the roll-up runs on
      // the merged set. A per-pass roll-up leaves the covered member in place.
      const handlerResult = makeHandlerResult({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: DIGITAL_EXPERIENCE_BUNDLE_TYPE,
            member: 'site/foo',
            changeKind: ChangeKind.Add,
          },
        ],
      })
      const postResult = makeHandlerResult({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: DIGITAL_EXPERIENCE_TYPE,
            member: 'site/foo.sfdc_cms__view/home',
            changeKind: ChangeKind.Add,
          },
          {
            target: ManifestTarget.Package,
            type: DIGITAL_EXPERIENCE_TYPE,
            member: 'site/bar.sfdc_cms__view/home',
            changeKind: ChangeKind.Add,
          },
        ],
      })

      // Act
      const result = assembleChanges(handlerResult, postResult, [])

      // Assert — the collector-pass member covered by the handler-pass bundle
      // is dropped; the uncovered member (a different site) survives.
      expect(
        result.changes.forPackageManifest().get(DIGITAL_EXPERIENCE_TYPE)
      ).toEqual(new Set(['site/bar.sfdc_cms__view/home']))
      expect(
        result.changes.forPackageManifest().get(DIGITAL_EXPERIENCE_BUNDLE_TYPE)
      ).toEqual(new Set(['site/foo']))
    })
  })

  describe('Given rename triples resolved alongside elements from both passes', () => {
    it('When assembleChanges runs, Then the rename relabels the emitted target and source out of the add and delete buckets', () => {
      // Arrange — the handler pass emits the target and the collector pass the
      // source: corroboration must read the merged set, and a rename only
      // relabels members that were emitted.
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [
          packaged('ApexClass', 'Untouched'),
          packaged('ApexClass', 'New'),
        ],
      })
      const postResult = makeHandlerResult({
        manifests: [deleted('ApexClass', 'Old')],
      })

      // Act
      const result = assembleChanges(handlerResult, postResult, renameTriples)

      // Assert
      expect(result.changes.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['Untouched', 'New'])
      )
      expect(result.changes.forDestructiveManifest().get('ApexClass')).toEqual(
        new Set(['Old'])
      )
      expect(
        result.changes.byChangeKind()[ChangeKind.Add].get('ApexClass')
      ).toEqual(new Set(['Untouched']))
      expect(
        result.changes.byChangeKind()[ChangeKind.Delete].get('ApexClass')
      ).toBeUndefined()
    })
  })

  describe('Given a rename whose source the collector pass also emits as a package member', () => {
    it('When assembleChanges runs, Then the rename relabels the target out of the add bucket and the packaged source stays an addition', () => {
      // Arrange — both sides are emitted, the source only as a package member
      // contributed by a collector, so the triple is kept.
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [packaged('ApexClass', 'New')],
      })
      const postResult = makeHandlerResult({
        manifests: [packaged('ApexClass', 'Old')],
      })

      // Act
      const result = assembleChanges(handlerResult, postResult, renameTriples)

      // Assert — the packaged source never appears as a deletion, and only the
      // add bucket tells a kept triple from a dropped one.
      expect(result.changes.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['Old', 'New'])
      )
      expect(
        result.changes.forDestructiveManifest().get('ApexClass')
      ).toBeUndefined()
      expect(
        result.changes.byChangeKind()[ChangeKind.Add].get('ApexClass')
      ).toEqual(new Set(['Old']))
    })
  })

  describe('Given a rename whose target the passes did not emit', () => {
    it('When assembleChanges runs, Then the rename is dropped and the target stays out of the package view', () => {
      // Arrange
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [deleted('ApexClass', 'Old')],
      })

      // Act
      const result = assembleChanges(
        handlerResult,
        emptyResult(),
        renameTriples
      )

      // Assert
      expect(
        result.changes.forPackageManifest().get('ApexClass')
      ).toBeUndefined()
      expect(result.changes.forDestructiveManifest().get('ApexClass')).toEqual(
        new Set(['Old'])
      )
    })
  })

  describe('Given a rename whose source the passes did not emit', () => {
    it('When assembleChanges runs, Then the rename is dropped and the source stays out of the destructive view', () => {
      // Arrange
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [packaged('ApexClass', 'New')],
      })

      // Act
      const result = assembleChanges(
        handlerResult,
        emptyResult(),
        renameTriples
      )

      // Assert
      expect(
        result.changes.forDestructiveManifest().get('ApexClass')
      ).toBeUndefined()
      expect(result.changes.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['New'])
      )
    })
  })

  describe('Given a rename whose target the passes emitted only as a deletion', () => {
    it('When assembleChanges runs, Then the rename is dropped and the target stays out of the package view', () => {
      // Arrange
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [deleted('ApexClass', 'New'), deleted('ApexClass', 'Old')],
      })

      // Act
      const result = assembleChanges(
        handlerResult,
        emptyResult(),
        renameTriples
      )

      // Assert
      expect(
        result.changes.forPackageManifest().get('ApexClass')
      ).toBeUndefined()
    })
  })

  describe('Given a rename whose target the passes emitted under another type', () => {
    it('When assembleChanges runs, Then the rename is dropped and the target stays out of the package view', () => {
      // Arrange
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [
          packaged('CustomObject', 'New'),
          deleted('ApexClass', 'Old'),
        ],
      })

      // Act
      const result = assembleChanges(
        handlerResult,
        emptyResult(),
        renameTriples
      )

      // Assert
      expect(
        result.changes.forPackageManifest().get('ApexClass')
      ).toBeUndefined()
      expect(result.changes.forPackageManifest().get('CustomObject')).toEqual(
        new Set(['New'])
      )
    })
  })

  describe('Given a DigitalExperience rename whose target the bundle roll-up drops', () => {
    it('When assembleChanges runs, Then the rename is dropped and the covered target stays out of the package view', () => {
      // Arrange
      const renameTriples: readonly RenameTriple[] = [
        {
          type: DIGITAL_EXPERIENCE_TYPE,
          from: 'site/foo.sfdc_cms__view/old',
          to: 'site/foo.sfdc_cms__view/home',
        },
      ]
      const handlerResult = makeHandlerResult({
        manifests: [
          packaged(DIGITAL_EXPERIENCE_BUNDLE_TYPE, 'site/foo'),
          packaged(DIGITAL_EXPERIENCE_TYPE, 'site/foo.sfdc_cms__view/home'),
        ],
      })
      const postResult = makeHandlerResult({
        manifests: [
          deleted(DIGITAL_EXPERIENCE_TYPE, 'site/foo.sfdc_cms__view/old'),
        ],
      })

      // Act
      const result = assembleChanges(handlerResult, postResult, renameTriples)

      // Assert
      expect(
        result.changes.forPackageManifest().get(DIGITAL_EXPERIENCE_TYPE)
      ).toBeUndefined()
      expect(
        result.changes.forPackageManifest().get(DIGITAL_EXPERIENCE_BUNDLE_TYPE)
      ).toEqual(new Set(['site/foo']))
      expect(
        result.changes.forDestructiveManifest().get(DIGITAL_EXPERIENCE_TYPE)
      ).toEqual(new Set(['site/foo.sfdc_cms__view/old']))
    })
  })

  describe('Given the handler pass and the collector pass each emit a copy operation', () => {
    it('When assembleChanges runs, Then the returned copies are the concatenation of both passes', () => {
      // Arrange
      const handlerCopy: GitCopyOperation = {
        kind: CopyOperationKind.GitCopy,
        path: 'handler/path',
        revision: 'HEAD',
      }
      const collectorCopy: GitCopyOperation = {
        kind: CopyOperationKind.GitCopy,
        path: 'collector/path',
        revision: 'HEAD',
      }
      const handlerResult = makeHandlerResult({ copies: [handlerCopy] })
      const postResult = makeHandlerResult({ copies: [collectorCopy] })

      // Act
      const result = assembleChanges(handlerResult, postResult, [])

      // Assert
      expect(result.copies).toEqual([handlerCopy, collectorCopy])
    })
  })
})
