'use strict'
const InFolder = require('../../../../src/service/inFolderHandler')
const { copyFiles, readDir } = require('../../../../src/utils/fsHelper')
const { METAFILE_SUFFIX } = require('../../../../src/utils/metadataConstants')

jest.mock('../../../../src/utils/fsHelper')

const entity = 'folder/test'
const extension = 'document'
const objectType = 'documents'
const xmlName = 'Document'
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
      expect(work.diffs.package.get(xmlName)).toEqual(new Set([entity]))
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
  describe('when called with generateDelta true', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })

    describe('when readDir does not return files', () => {
      it('should not copy special extension and copy meta files', async () => {
        // Arrange
        const sut = new InFolder(line, objectType, work, globalMetadata)
        readDir.mockImplementation(() => Promise.resolve([]))

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(xmlName)).toEqual(new Set([entity]))
        expect(readDir).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(3)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining(METAFILE_SUFFIX)
        )
      })
    })

    describe('when readDir returns files', () => {
      it('should copy special extension', async () => {
        // Arrange
        const sut = new InFolder(line, objectType, work, globalMetadata)
        readDir.mockImplementationOnce(() =>
          Promise.resolve([entity, 'not/matching'])
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(xmlName)).toEqual(new Set([entity]))
        expect(readDir).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(5)
      })
    })
  })
  describe('when the line should not be processed', () => {
    it.each([`force-app/main/default/${objectType}/test.otherExtension`])(
      'does not handle the line',
      async entityPath => {
        // Arrange
        const sut = new InFolder(
          `A       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.size).toBe(0)
        expect(copyFiles).not.toHaveBeenCalled()
      }
    )
  })
})
