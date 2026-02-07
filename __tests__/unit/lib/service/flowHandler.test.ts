'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { DELETION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import FlowHandler from '../../../../src/service/flowHandler'
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
})
