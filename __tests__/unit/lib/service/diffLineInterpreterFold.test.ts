'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import StandardHandler from '../../../../src/service/standardHandler'
import TypeHandlerFactory from '../../../../src/service/typeHandlerFactory'
import type { Config } from '../../../../src/types/config'
import type {
  HandlerResult,
  ManifestElement,
} from '../../../../src/types/handlerResult'
import ChangeSet, { type RenameTriple } from '../../../../src/utils/changeSet'
import { getConfig } from '../../../__utils__/testWork'

const sortKey = (e: ManifestElement) =>
  `${e.target}\0${e.type}\0${e.member}\0${e.changeKind}`
const byCoord = (elements: readonly ManifestElement[]) =>
  [...elements].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

let config: Config
beforeEach(() => {
  config = getConfig()
})

describe('DiffLineInterpreter fold', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('T4 (R3) — completeness', () => {
    it("Given a corpus of diff lines, including one that routes to ReportingFolderHandler with a falsy resolvedType, When process folds the pass, Then the whole element multiset equals the concatenation of each handler's own returned elements", async () => {
      // Arrange — 'reports/folder/entity.unknownext-meta.xml' is processable
      // (nested subfolder makes _parentFolderIsNotTheType true) but its
      // extension has no entry in the shared-folder metadata map, so
      // ReportingFolderHandler.collectAddition explicitly returns
      // emptyResult() — the path where "returned" and "actual" changes
      // diverge under the old shared-sink design.
      const lines = [
        'A\tforce-app/main/default/classes/Foo.cls',
        'A\tforce-app/main/default/classes/Bar.cls',
        'A\tforce-app/main/default/reports/folder/entity.unknownext-meta.xml',
      ]
      const sut = new DiffLineInterpreter(config, globalMetadata)

      // Act
      const folded = await sut.process(lines)

      // Assert — fold each line's own handler independently and compare the
      // whole multiset, not membership of a single type under a single
      // target (services.test.ts already covers that narrower shape).
      const perLineFactory = new TypeHandlerFactory(config, globalMetadata)
      const expectedResults: HandlerResult[] = []
      for (const line of lines) {
        const handler = await perLineFactory.getTypeHandler(line)
        expectedResults.push(await handler.collect())
      }
      const expectedElements = expectedResults.flatMap(r => r.elements)

      expect(byCoord(folded.elements)).toEqual(byCoord(expectedElements))
      // The divergent line contributes nothing — confirms the multiset
      // isn't padded by a stale sink read.
      expect(folded.elements).toHaveLength(2)
    })
  })

  describe('T5b (ADR 003) — fold totality', () => {
    it("Given a pass where one handler's collect() rejects, When process runs, Then it still drains and every other handler's elements are present", async () => {
      // Arrange — guards BoundedQueue._fail turning a per-file failure into
      // a whole-run abort: without the worker's own try/catch, a rejected
      // handler.collect() clears `pending` and rejects every drain() waiter,
      // silently discarding every already-collected result. Every family in
      // this corpus shares StandardHandler.prototype.collect, and
      // BoundedQueue._pump drives pushed items through their first await
      // point synchronously and in push order, so the "once" rejection lands
      // on the first line's handler deterministically.
      const lines = [
        'A\tforce-app/main/default/classes/A.cls',
        'A\tforce-app/main/default/classes/B.cls',
        'A\tforce-app/main/default/classes/C.cls',
      ]
      const collectSpy = vi.spyOn(StandardHandler.prototype, 'collect')
      collectSpy.mockRejectedValueOnce(new Error('handler exploded'))
      const sut = new DiffLineInterpreter(config, globalMetadata)

      // Act
      const result = await sut.process(lines)
      collectSpy.mockRestore()

      // Assert — drains (resolves) despite the rejection, and the two
      // surviving handlers' elements are present.
      expect(result.elements.map(e => e.member).sort()).toEqual(['B', 'C'])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('handler exploded')
    })
  })

  describe('T6 (D2/D5) — fold order-independence', () => {
    it('Given a corpus with a cancel pair, a duplicate, a DigitalExperience/DigitalExperienceBundle pair, and a rename leg, When the input line order and the rename order are both permuted, Then the manifest views built from the fold are invariant', async () => {
      // Arrange
      const cancelAdd = 'A\tforce-app/main/default/classes/Foo.cls'
      const cancelDelete = 'D\tforce-app/main/default/classes/Foo.cls'
      const duplicateA = 'A\tforce-app/main/default/classes/Bar.cls'
      const duplicateB = 'A\tforce-app/main/default/classes/Bar.cls'
      const bundle =
        'A\tforce-app/main/default/digitalExperiences/site/Site_A/Site_A.digitalExperience-meta.xml'
      const page =
        'A\tforce-app/main/default/digitalExperiences/site/Site_A/sfdc_cms__view/page_a/content.json'
      const original = [
        cancelAdd,
        cancelDelete,
        duplicateA,
        duplicateB,
        bundle,
        page,
      ]
      const linePermutations = [
        original,
        [...original].reverse(),
        [page, cancelDelete, duplicateB, bundle, cancelAdd, duplicateA],
      ]
      const renameTriples: RenameTriple[] = [
        { type: 'ApexTrigger', from: 'OldTrigger', to: 'NewTrigger' },
        { type: 'CustomObject', from: 'OldObj__c', to: 'NewObj__c' },
      ]
      const renamePermutations = [renameTriples, [...renameTriples].reverse()]

      // Act — the fold and the rename channel are independent inputs to
      // ChangeSet.from, so every (line order, rename order) combination is
      // exercised without re-running the handler pipeline per rename order.
      const elementsByLinePermutation = await Promise.all(
        linePermutations.map(async lines => {
          const sut = new DiffLineInterpreter(config, globalMetadata)
          const result = await sut.process(lines)
          return result.elements
        })
      )
      const folds = elementsByLinePermutation.flatMap(elements =>
        renamePermutations.map(renames => ChangeSet.from(elements, renames))
      )

      // Assert — every combination converges to the same manifest views.
      const [reference, ...rest] = folds
      for (const changeSet of rest) {
        expect(changeSet.forPackageManifest()).toEqual(
          reference!.forPackageManifest()
        )
        expect(changeSet.forDestructiveManifest()).toEqual(
          reference!.forDestructiveManifest()
        )
        expect(changeSet.byChangeKind()).toEqual(reference!.byChangeKind())
      }
      // Sanity: the cancel pair actually cancelled, the bundle/page pair
      // actually landed, and the rename leg actually folded into both
      // manifest views — so the invariance check isn't vacuous.
      expect(reference!.forDestructiveManifest().has('ApexClass')).toBe(false)
      expect(reference!.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['Foo', 'Bar'])
      )
      expect(
        reference!.forPackageManifest().get('DigitalExperienceBundle')
      ).toEqual(new Set(['site/Site_A']))
      expect(reference!.forPackageManifest().get('ApexTrigger')).toEqual(
        new Set(['NewTrigger'])
      )
      expect(reference!.forDestructiveManifest().get('ApexTrigger')).toEqual(
        new Set(['OldTrigger'])
      )
      expect(reference!.forPackageManifest().get('CustomObject')).toEqual(
        new Set(['NewObj__c'])
      )
    })
  })
})
