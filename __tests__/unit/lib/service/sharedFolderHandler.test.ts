'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import SharedFolderHandler from '../../../../src/service/sharedFolderHandler'
import { copyFiles } from '../../../../src/utils/fsHelper'
import { METAFILE_SUFFIX } from '../../../../src/utils/metadataConstants'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/types/metadata'

jest.mock('../../../../src/utils/fsHelper')

const objectType = 'discovery'
const entityName = 'DiscoveryAIModelTest'
const entityExtension = 'model'
const basePath = `force-app/main/default/`
const line = `A       ${basePath}${objectType}/${entityName}.${entityExtension}`
const entityType = 'DiscoveryAIModel'

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  work.config.generateDelta = false
})

describe('SharedFolderHandler', () => {
  let globalMetadata: MetadataRepository
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
    expect(work.diffs.package.get(entityType)!.size).toEqual(1)
    expect(work.diffs.package.get(entityType)).toEqual(new Set([entityName]))
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
      expect(work.diffs.package.get(entityType)!.size).toEqual(1)
      expect(work.diffs.package.get(entityType)).toEqual(new Set([entityName]))
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
