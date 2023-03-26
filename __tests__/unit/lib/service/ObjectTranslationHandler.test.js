'use strict'
const ObjectTranslation = require('../../../../src/service/ObjectTranslationHandler')
const { copyFiles } = require('../../../../src/utils/fsHelper')

jest.mock('../../../../src/utils/fsHelper')

const objectType = 'objectTranslations'
const xmlName = 'CustomObjectTranslation'
const line =
  'A       force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml'

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
      expect(copyFiles).not.toBeCalled()
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

      expect(copyFiles).toBeCalledTimes(2)
      expect(copyFiles).toHaveBeenCalledWith(
        work.config,
        expect.stringContaining('Account-es.objectTranslation')
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

        expect(copyFiles).toBeCalledTimes(2)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining('BillingFloor__c.fieldTranslation')
        )
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining('Account-es.objectTranslation')
        )
        expect(...work.diffs.package.get(xmlName)).toEqual('Account-es')
      })
    })
  })

  // TODO add inFile pruning
})
