'use strict'
const SharedFolderHandler = require('../../../../src/service/sharedFolderHandler')

const objectType = 'discovery'
const entityName = 'DiscoveryAIModelTest'
const entityExtension = 'model'
const line = `A       force-app/main/default/${objectType}/${entityName}.${entityExtension}`
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
})
