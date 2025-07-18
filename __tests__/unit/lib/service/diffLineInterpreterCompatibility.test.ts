'use strict'

import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('node:os', () => ({
  availableParallelism: null,
}))

const mockHandle = jest.fn()
jest.mock('../../../../src/service/typeHandlerFactory', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        getTypeHandler: jest
          .fn()
          .mockImplementation(() => ({ handle: mockHandle })),
      }
    }),
  }
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('DiffLineInterpreter', () => {
  let sut: DiffLineInterpreter
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })

  describe('compatibility test', () => {
    beforeEach(() => {
      sut = new DiffLineInterpreter(work, globalMetadata)
    })
    describe('when `availableParallelism` is not defined', () => {
      it('fallback gracefully', async () => {
        // Arrange
        const lines = ['test']

        // Act
        await sut.process(lines)

        // Assert
        expect(mockHandle).toHaveBeenCalledTimes(lines.length)
      })
    })
  })
})
