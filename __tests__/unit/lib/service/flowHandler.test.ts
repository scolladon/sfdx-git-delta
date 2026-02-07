'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { DELETION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import FlowHandler from '../../../../src/service/flowHandler'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/MessageService')

const objectType = {
  directoryName: 'flows',
  inFolder: false,
  metaFile: false,
  suffix: 'flow',
  xmlName: 'Flow',
}
const basePath = `force-app/main/default/${objectType.directoryName}`
let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('flowHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })
  describe('when a flow is deleted', () => {
    it('warns the user not to', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `${DELETION}       ${basePath}/MyFlow.${objectType.suffix}-meta.xml`,
        objectType,
        globalMetadata
      )
      const sut = new FlowHandler(changeType, element, work)
      expect(work.warnings.length).toBe(0)

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings.length).toBe(1)
    })
  })

  describe('collect', () => {
    it('Given flow deletion, When collectDeletion is called, Then returns destructive manifest with warning', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `${DELETION}       ${basePath}/MyFlow.${objectType.suffix}-meta.xml`,
        objectType,
        globalMetadata
      )
      const sut = new FlowHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0].target).toBe(ManifestTarget.DestructiveChanges)
      expect(result.manifests[0].type).toBe('Flow')
      expect(result.warnings).toHaveLength(1)
    })
  })
})
