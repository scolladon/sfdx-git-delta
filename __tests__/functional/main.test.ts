;`use strict`
import { expect, jest, describe, it } from '@jest/globals'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sgd = require('../../src/main')

const mockValidateConfig = jest.fn()
jest.mock('../../src/utils/cliHelper', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualModule: any = jest.requireActual('../../src/utils/cliHelper')
  return jest.fn().mockImplementation(() => {
    return {
      ...actualModule,
      validateConfig: mockValidateConfig,
    }
  })
})

const mockGetLines = jest.fn()
jest.mock('../../src/utils/repoGitDiff', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualModule: any = jest.requireActual('../../src/utils/repoGitDiff')
  return jest.fn().mockImplementation(() => {
    return {
      ...actualModule,
      getLines: mockGetLines,
    }
  })
})

const mockProcess = jest.fn()
jest.mock('../../src/service/diffLineInterpreter', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualModule: any = jest.requireActual(
    '../../src/service/diffLineInterpreter'
  )
  return jest.fn().mockImplementation(() => {
    return {
      ...actualModule,
      process: mockProcess,
    }
  })
})

describe('external library inclusion', () => {
  describe('when configuration is not valid', () => {
    beforeEach(() => {
      // Arrange
      mockValidateConfig.mockImplementationOnce(() =>
        Promise.reject(new Error('test'))
      )
    })

    it('it should throw', async () => {
      // Arrange
      expect.assertions(1)

      // Act
      try {
        await sgd({})
      } catch (error) {
        // Assert
        expect((error as Error).message).toEqual('test')
      }
    })
  })

  describe('when there are no changes', () => {
    beforeEach(() => {
      // Arrange
      mockGetLines.mockImplementationOnce(() => Promise.resolve([]))
    })
    it('it should not process lines', async () => {
      // Act
      await sgd({})

      // Assert
      expect(mockProcess).toBeCalledWith([])
    })
  })

  describe('when there are changes', () => {
    beforeEach(() => {
      // Arrange
      mockGetLines.mockImplementationOnce(() => Promise.resolve(['line']))
    })
    it('it should process those lines', async () => {
      // Act
      await sgd({})

      // Assert
      expect(mockProcess).toBeCalledWith(['line'])
    })
  })
})
