'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import SharedFolderHandler from '../../../../src/service/sharedFolderHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

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
    globalMetadata = await getDefinition({})
  })

  it('should add the metadata component under the right type to the package', async () => {
    // Arrange
    const { changeType, element } = createElement(
      line,
      objectType,
      globalMetadata
    )
    const sut = new SharedFolderHandler(changeType, element, work)

    // Act
    const result = await sut.collectAddition()

    // Assert
    expect(result.manifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: ManifestTarget.Package,
          type: entityType,
          member: entityName,
        }),
      ])
    )
  })

  describe('when extension has no matching type', () => {
    it('should not add to package', async () => {
      // Arrange
      const unknownExtLine = `A       ${basePath}${objectType}/Test.unknownext`
      const { changeType, element } = createElement(
        unknownExtLine,
        objectType,
        globalMetadata
      )
      const sut = new SharedFolderHandler(changeType, element, work)

      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(result.manifests).toEqual([])
    })
  })
  describe('when it should generate output file', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })
    it('should add and copy the metadata', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new SharedFolderHandler(changeType, element, work)

      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: entityType,
            member: entityName,
          }),
        ])
      )
      expect(result.copies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: CopyOperationKind.GitCopy,
            path: `${basePath}${objectType}/${entityName}.${entityExtension}`,
          }),
          expect.objectContaining({
            kind: CopyOperationKind.GitCopy,
            path: `${basePath}${objectType}/${entityName}.${entityExtension}${METAFILE_SUFFIX}`,
          }),
        ])
      )
      expect(result.copies).toHaveLength(2)
    })
  })
})
