'use strict'

import { expect, jest, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('os', () => ({
  availableParallelism: null,
}))

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
    // eslint-disable-next-line no-undef
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
        expect(mockHandle).toBeCalledTimes(lines.length)
      })
    })
  })
})
