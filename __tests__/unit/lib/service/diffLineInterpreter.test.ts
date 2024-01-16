'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'

const mockHandle = jest.fn()
jest.mock('../../../../src/service/typeHandlerFactory', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getTypeHandler: jest.fn().mockImplementation(() => {
        return { handle: mockHandle }
      }),
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
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    sut = new DiffLineInterpreter(work, globalMetadata)
  })

  describe('when called with lines', () => {
    it('process each lines', () => {
      // Arrange
      const lines = ['test']

      // Act
      sut.process(lines)

      // Assert
      expect(mockHandle).toBeCalledTimes(1)
    })
  })

  describe('when called without lines', () => {
    it('it does not process anything', () => {
      // Arrange
      const lines: string[] = []

      // Act
      sut.process(lines)

      // Assert
      expect(mockHandle).not.toBeCalled()
    })
  })
})
