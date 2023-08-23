'use strict'
const SharedFolderHandler = require('../../../../src/service/sharedFolderHandler')
const { copyFiles } = require('../../../../src/utils/fsHelper')
const { METAFILE_SUFFIX } = require('../../../../src/utils/metadataConstants')

jest.mock('../../../../src/utils/fsHelper')

const objectType = 'discovery'
const entityName = 'DiscoveryAIModelTest'
const entityExtension = 'model'
const basePath = `force-app/main/default/`
const line = `A       ${basePath}${objectType}/${entityName}.${entityExtension}`
const entityType = 'DiscoveryAIModel'

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '', generateDelta: false },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('SharedFolderHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  it('should add the metadata component under the right type to the package', async () => {
    // Arrange
    const sut = new SharedFolderHandler(line, objectType, work, globalMetadata)

    // Act
    await sut.handleAddition()

    // Assert
    expect(work.diffs.package.get(entityType).size).toEqual(1)
    expect(...work.diffs.package.get(entityType)).toEqual(entityName)
  })
  describe('when it should generate output file', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })
    it('should add and copy the metadata', async () => {
      const sut = new SharedFolderHandler(
        line,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.package.get(entityType).size).toEqual(1)
      expect(...work.diffs.package.get(entityType)).toEqual(entityName)
      expect(copyFiles).toBeCalledTimes(2)
      expect(copyFiles).toBeCalledWith(
        work.config,
        `${basePath}${objectType}/${entityName}.${entityExtension}`
      )
      expect(copyFiles).toBeCalledWith(
        work.config,
        `${basePath}${objectType}/${entityName}.${entityExtension}${METAFILE_SUFFIX}`
      )
    })
  })
})
