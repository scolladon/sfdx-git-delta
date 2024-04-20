'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

const mockHandle = jest.fn()
jest.mock('../../../../src/service/typeHandlerFactory', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getTypeHandler: jest
        .fn()
        .mockImplementation(() => ({ handle: mockHandle })),
    }
  })
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
      expect(mockHandle).toBeCalledTimes(lines.length)
    })
  })

  describe('when called without lines', () => {
    it('it does not process anything', async () => {
      // Arrange
      const lines: string[] = []

      // Act
      await sut.process(lines)

      // Assert
      expect(mockHandle).not.toBeCalled()
    })
  })
})
