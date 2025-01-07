'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { DELETION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import FlowHandler from '../../../../src/service/flowHandler'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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
    globalMetadata = await getGlobalMetadata()
  })
  describe('when a flow is deleted', () => {
    it('warns the user not to', async () => {
      // Arrange
      const sut = new FlowHandler(
        `${DELETION}       ${basePath}/MyFlow.${objectType.suffix}-meta.xml`,
        objectType,
        work,
        globalMetadata
      )
      expect(work.warnings.length).toBe(0)

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings.length).toBe(1)
    })
  })
})
