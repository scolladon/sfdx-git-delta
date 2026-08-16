'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BaseProcessor, {
  emptyOutcome,
  type ProcessorOutcome,
} from '../../../../src/post-processor/baseProcessor'
import type { RunContext } from '../../../../src/types/runContext'
import ChangeSet from '../../../../src/utils/changeSet'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { getConfig, getContext } from '../../../__utils__/testWork'

class TestProcessor extends BaseProcessor {
  public override async process(
    _changes: ChangeSet
  ): Promise<ProcessorOutcome> {
    return emptyOutcome()
  }
}

describe('BaseProcessor', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  describe('isCollector', () => {
    it('Given default base processor, When isCollector, Then returns false', () => {
      // Arrange
      const config = getConfig()
      const sut = new TestProcessor(getContext({ config, metadata }))

      // Act
      const result = sut.isCollector

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('transformAndCollect', () => {
    it('Given default base processor, When transformAndCollect, Then returns empty result', async () => {
      // Arrange
      const config = getConfig()
      const sut = new TestProcessor(getContext({ config, metadata }))

      // Act
      const result = await sut.transformAndCollect(new ChangeSet())

      // Assert
      expect(elementsOf(result)).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })
})
