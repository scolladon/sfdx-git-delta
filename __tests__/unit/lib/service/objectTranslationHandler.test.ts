'use strict'
import { describe, expect, it, jest } from '@jest/globals'

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

const mockCompare = jest.fn<() => Promise<any>>()
const mockprune = jest.fn<() => any>()
jest.mock('../../../../src/utils/metadataDiff', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return { compare: mockCompare, prune: mockprune }
    }),
  }
})

jest.mock('../../../../src/utils/fsHelper')

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

const xmlContent = '<xmlContent>'
const toContent = {}
const fromContent = {}

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  mockCompare.mockResolvedValue({
    added: new Map(),
    deleted: new Map(),
    toContent,
    fromContent,
  })
  mockprune.mockReturnValue({ xmlContent })
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
            c.kind === CopyOperationKind.ComputedContent &&
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
        result.copies.some(c => c.kind === CopyOperationKind.ComputedContent)
      ).toBe(true)
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
