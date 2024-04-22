'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import SharedFolderHandler from '../../../../src/service/sharedFolderHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const objectType = {
  directoryName: 'discovery',
  inFolder: false,
  metaFile: true,
  content: [
    {
      suffix: 'model',
      xmlName: 'DiscoveryAIModel',
    },
    {
      suffix: 'goal',
      xmlName: 'DiscoveryGoal',
    },
  ],
}
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
