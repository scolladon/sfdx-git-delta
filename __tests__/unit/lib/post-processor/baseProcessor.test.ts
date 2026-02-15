'use strict'
import { describe, expect, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BaseProcessor from '../../../../src/post-processor/baseProcessor'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

class TestProcessor extends BaseProcessor {
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
  }
  public override async process(): Promise<void> {}
}

describe('BaseProcessor', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  describe('isCollector', () => {
    it('Given default base processor, When isCollector, Then returns false', () => {
      // Arrange
      const work = getWork()
      const sut = new TestProcessor(work, metadata)

      // Act
      const result = sut.isCollector

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('transformAndCollect', () => {
    it('Given default base processor, When transformAndCollect, Then returns empty result', async () => {
      // Arrange
      const work = getWork()
      const sut = new TestProcessor(work, metadata)

      // Act
      const result = await sut.transformAndCollect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })
})
