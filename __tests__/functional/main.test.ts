'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import sgd from '../../src/main'
import type { Config } from '../../src/types/config'

const mockValidateConfig = jest.fn()
jest.mock('../../src/utils/cliHelper', () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
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
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
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
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
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
        await sgd({} as Config)
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
      await sgd({} as Config)

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
      await sgd({} as Config)

      // Assert
      expect(mockProcess).toBeCalledWith(['line'])
    })
  })
})
