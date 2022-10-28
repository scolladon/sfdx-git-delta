'use strict'
const InFolder = require('../../../../src/service/inFolderHandler')
const { copyFiles } = require('../../../../src/utils/fsHelper')
const { readdir } = require('fs').promises
const { METAFILE_SUFFIX } = require('../../../../src/utils/metadataConstants')

jest.mock('../../../../src/utils/fsHelper')
jest.mock('fs')

const entity = 'folder/test'
const extension = 'document'
const objectType = 'documents'
const line = `A       force-app/main/default/${objectType}/${entity}.${extension}-meta.xml`

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '' },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('InFolderHander', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe('when called with generateDelta false', () => {
    beforeEach(() => {
      work.config.generateDelta = false
    })
    it('should not copy meta files nor copy special extension', async () => {
      // Arrange
      const sut = new InFolder(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
  describe('when called with generateDelta true', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })
    it('should copy meta files', async () => {
      // Arrange
      const sut = new InFolder(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
      expect(copyFiles).toHaveBeenCalledWith(
        work,
        expect.stringContaining(METAFILE_SUFFIX),
        expect.stringContaining(METAFILE_SUFFIX)
      )
    })

    describe('when readdir does not return files', () => {
      it('should not copy special extension', async () => {
        // Arrange
        const sut = new InFolder(line, objectType, work, globalMetadata)
        readdir.mockImplementationOnce(() => Promise.resolve([]))

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
        expect(readdir).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(3)
      })
    })

    describe('when readdir returns files', () => {
      it('should copy special extension', async () => {
        // Arrange
        const sut = new InFolder(line, objectType, work, globalMetadata)
        readdir.mockImplementationOnce(() =>
          Promise.resolve([entity, 'not/matching'])
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
        expect(readdir).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(5)
      })
    })
  })
})
