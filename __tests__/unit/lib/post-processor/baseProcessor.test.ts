'use strict'
import { beforeAll, expect, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import BaseProcessor from '../../../../src/post-processor/baseProcessor'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'

describe('BaseProcessor', () => {
  let work: Work, metadata: MetadataRepository
  beforeAll(async () => {
    work = getWork()
    metadata = await getGlobalMetadata()
  })
  describe('when process is called', () => {
    it('throws an error', async () => {
      // Arrange
      expect.assertions(1)
      const sut = new BaseProcessor(work, metadata)

      // Act
      try {
        await sut.process()
      } catch (error) {
        // Assert
        expect((error as Error).message).toEqual('this class should be derived')
      }
    })
  })
})
