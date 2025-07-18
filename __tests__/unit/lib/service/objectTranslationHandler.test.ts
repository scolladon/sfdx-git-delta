'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import ObjectTranslation from '../../../../src/service/objectTranslationHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, writeFile } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

const mockCompare = jest.fn()
const mockprune = jest.fn()
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
const xmlName = 'CustomObjectTranslation'
const line =
  'A       force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml'

const xmlContent = '<xmlContent>'
mockprune.mockReturnValue({ xmlContent })

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('ObjectTranslation', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })

  describe('when called with generateDelta false', () => {
    it('should not copy files', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new ObjectTranslation(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert
      expect(writeFile).not.toHaveBeenCalled()
      expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
        'Account-es',
      ])
    })
  })

  describe('when called with generateDelta true', () => {
    it('should copy object translations files', async () => {
      // Arrange
      const sut = new ObjectTranslation(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert
      expect(copyFiles).not.toHaveBeenCalled()
      expect(writeFile).toHaveBeenCalledTimes(1)
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('Account-es.objectTranslation'),
        xmlContent,
        work.config
      )
      expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
        'Account-es',
      ])
    })

    describe('when called with fieldTranslation', () => {
      const fieldTranslationline =
        'A       force-app/main/default/objectTranslations/Account-es/BillingFloor__c.fieldTranslation-meta.xml'
      it('should copy object translations files and fieldTranslation', async () => {
        // Arrange
        const sut = new ObjectTranslation(
          fieldTranslationline,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(copyFiles).toHaveBeenCalledTimes(2)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining('BillingFloor__c.fieldTranslation')
        )
        expect(writeFile).toHaveBeenCalledTimes(1)
        expect(writeFile).toHaveBeenCalledWith(
          expect.stringContaining('Account-es.objectTranslation'),
          xmlContent,
          work.config
        )
        expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
          'Account-es',
        ])
      })
    })
  })
})
