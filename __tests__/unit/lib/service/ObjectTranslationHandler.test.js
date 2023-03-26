'use strict'
const ObjectTranslation = require('../../../../src/service/ObjectTranslationHandler')
const { writeFile, copyFiles } = require('../../../../src/utils/fsHelper')
const mockCompare = jest.fn()
const mockprune = jest.fn()
jest.mock('../../../../src/utils/metadataDiff', () => {
  return jest.fn().mockImplementation(() => {
    return { compare: mockCompare, prune: mockprune }
  })
})

jest.mock('../../../../src/utils/fsHelper')

const objectType = 'objectTranslations'
const xmlName = 'CustomObjectTranslation'
const line =
  'A       force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml'

const content = 'content'
mockprune.mockReturnValue(content)

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('ObjectTranslation', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
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
      expect(writeFile).not.toBeCalled()
      expect(...work.diffs.package.get(xmlName)).toEqual('Account-es')
    })
  })

  describe('when called with generateDelta true', () => {
    it('should copy object translations files', async () => {
      // Arrange
      const sut = new ObjectTranslation(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert

      expect(writeFile).toBeCalledTimes(1)
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('Account-es.objectTranslation'),
        content,
        work.config
      )
      expect(...work.diffs.package.get(xmlName)).toEqual('Account-es')
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
        expect(copyFiles).toBeCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining('BillingFloor__c.fieldTranslation')
        )
        expect(writeFile).toBeCalledTimes(1)
        expect(writeFile).toHaveBeenCalledWith(
          expect.stringContaining('Account-es.objectTranslation'),
          content,
          work.config
        )
        expect(...work.diffs.package.get(xmlName)).toEqual('Account-es')
      })
    })
  })
})
