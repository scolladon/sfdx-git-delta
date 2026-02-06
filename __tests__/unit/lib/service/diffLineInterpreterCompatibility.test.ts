'use strict'

import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

jest.mock('node:os', () => ({
  ...(jest.requireActual('node:os') as object),
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
    globalMetadata = await getDefinition({})
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
