'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import { emptyResult } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

const mockCollect = jest.fn<() => Promise<HandlerResult>>()
jest.mock('../../../../src/service/typeHandlerFactory', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        getTypeHandler: jest
          .fn()
          .mockImplementation(async () => ({ collect: mockCollect })),
      }
    }),
  }
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  mockCollect.mockResolvedValue(emptyResult())
  work = getWork()
})

describe('DiffLineInterpreter', () => {
  let sut: DiffLineInterpreter
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    sut = new DiffLineInterpreter(work, globalMetadata)
  })

  describe('when called with lines', () => {
    it('process each lines', async () => {
      // Arrange
      const lines = ['test']

      // Act
      await sut.process(lines)

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(lines.length)
    })
  })

  describe('when called without lines', () => {
    it('it does not process anything', async () => {
      // Arrange
      const lines: string[] = []

      // Act
      await sut.process(lines)

      // Assert
      expect(mockCollect).not.toHaveBeenCalled()
    })
  })
})
