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
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { RenameTriple } from '../../../../src/utils/changeSet'
import { assembleChanges } from '../../../../src/utils/changesAssembly'
import { makeHandlerResult } from '../../../__utils__/handlerResultView'

describe('assembleChanges', () => {
  describe('Given the handler pass and the collector pass each emit a warning, and a covered DigitalExperience member triggers a roll-up warning', () => {
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
      const handlerResult = makeHandlerResult({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: DIGITAL_EXPERIENCE_BUNDLE_TYPE,
            member: 'site/foo',
            changeKind: ChangeKind.Add,
          },
          {
            target: ManifestTarget.Package,
            type: DIGITAL_EXPERIENCE_TYPE,
            member: 'site/foo.sfdc_cms__view/home',
            changeKind: ChangeKind.Add,
          },
        ],
      })
      const postResult = makeHandlerResult({
        manifests: [
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

      // Assert — the handler-pass member covered by the bundle is dropped;
      // the collector-pass member (a different site, not covered) survives.
      expect(
        result.changes.forPackageManifest().get(DIGITAL_EXPERIENCE_TYPE)
      ).toEqual(new Set(['site/bar.sfdc_cms__view/home']))
      expect(
        result.changes.forPackageManifest().get(DIGITAL_EXPERIENCE_BUNDLE_TYPE)
      ).toEqual(new Set(['site/foo']))
    })
  })

  describe('Given rename triples resolved from the handler and collector passes', () => {
    it('When assembleChanges runs, Then the rename target lands on the package view and the rename source lands on the destructive view', () => {
      // Arrange
      const renameTriples: readonly RenameTriple[] = [
        { type: 'ApexClass', from: 'Old', to: 'New' },
      ]

      // Act
      const result = assembleChanges(
        emptyResult(),
        emptyResult(),
        renameTriples
      )

      // Assert
      expect(result.changes.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['New'])
      )
      expect(result.changes.forDestructiveManifest().get('ApexClass')).toEqual(
        new Set(['Old'])
      )
    })
  })

  describe('Given the handler pass and the collector pass each emit a copy operation', () => {
    it('When assembleChanges runs, Then the returned copies are the concatenation of both passes', () => {
      // Arrange
      const handlerCopy = {
        kind: CopyOperationKind.GitCopy,
        path: 'handler/path',
        revision: 'HEAD',
      }
      const collectorCopy = {
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
