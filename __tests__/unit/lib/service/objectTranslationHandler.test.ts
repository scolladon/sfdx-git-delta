'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ObjectTranslation from '../../../../src/service/objectTranslationHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

const { mockRun, mockWriter } = vi.hoisted(() => ({
  mockRun: vi.fn<() => Promise<any>>(),
  mockWriter: vi.fn(),
}))

vi.mock('../../../../src/utils/metadataDiff', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { run: mockRun }
    }),
  }
})

vi.mock('../../../../src/utils/fsHelper')

const objectType = {
  directoryName: 'objectTranslations',
  inFolder: false,
  metaFile: false,
  suffix: 'objectTranslation',
  xmlName: 'CustomObjectTranslation',
  pruneOnly: true,
}
const line =
  'A       force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml'

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  mockRun.mockResolvedValue({
    manifests: { added: [], modified: [], deleted: [] },
    hasAnyChanges: true,
    writer: mockWriter,
  })
  work = getWork()
})

describe('ObjectTranslation', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('collect', () => {
    it('Given objectTranslation addition, When collect, Then includes ComputedContent for pruned translation XML', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new ObjectTranslation(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomObjectTranslation',
            member: 'Account-es',
          }),
        ])
      )
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.StreamedContent &&
            c.path.includes('Account-es.objectTranslation')
        )
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given objectTranslation addition with generateDelta false, When collect, Then returns manifest without copies', async () => {
      // Arrange
      work.config.generateDelta = false
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new ObjectTranslation(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0].target).toBe(ManifestTarget.Package)
      expect(result.copies).toHaveLength(0)
    })

    it('Given objectTranslation file addition, When collect, Then does NOT produce GitCopy operations', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new ObjectTranslation(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(
        result.copies.every(c => c.kind !== CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.StreamedContent)
      ).toBe(true)
    })

    it('Given objectTranslation addition with generateDelta true, When collect, Then _shouldCollectCopies allows ComputedContent', async () => {
      // Arrange
      work.config.generateDelta = true
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new ObjectTranslation(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.StreamedContent)
      ).toBe(true)
    })

    it('Given fieldTranslation addition, When collect, Then includes both file copies and ComputedContent', async () => {
      // Arrange
      const fieldTranslationLine =
        'A       force-app/main/default/objectTranslations/Account-es/BillingFloor__c.fieldTranslation-meta.xml'
      const { changeType, element } = createElement(
        fieldTranslationLine,
        objectType,
        globalMetadata
      )
      const sut = new ObjectTranslation(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomObjectTranslation',
            member: 'Account-es',
          }),
        ])
      )
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.StreamedContent)
      ).toBe(true)
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
