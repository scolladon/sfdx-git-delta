'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import type { Work } from '../../../../src/types/work'
import { IgnoreHelper } from '../../../../src/utils/ignoreHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

const mockProcess = jest.fn()
jest.mock('../../../../src/service/diffLineInterpreter', () => {
  return jest.fn().mockImplementation(() => {
    return {
      process: mockProcess,
    }
  })
})

const mockGetFilesPath = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => ({
  getInstance: jest.fn(() => ({
    getFilesPath: mockGetFilesPath,
    getFirstCommitRef: jest.fn(),
  })),
}))

const mockKeep = jest.fn()
jest.spyOn(IgnoreHelper, 'getIncludeInstance').mockResolvedValue({
  keep: mockKeep,
} as never)

describe('IncludeProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    work = getWork()
    jest.clearAllMocks()
  })

  describe('when no include is configured', () => {
    it('does not process include', async () => {
      // Arrange
      const sut = new IncludeProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(mockProcess).not.toBeCalled()
    })
  })

  describe('when include is configured', () => {
    beforeAll(() => {
      mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
    })

    describe('when no file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(true)
      })
      it('does not process include', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockProcess).not.toBeCalled()
      })
    })

    describe('when file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(false)
      })
      it('process include', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockProcess).toBeCalled()
      })
    })
  })

  describe('when includeDestructive is configured', () => {
    beforeAll(() => {
      mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
    })
    describe('when no file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(true)
      })
      it('does not process include destructive', async () => {
        // Arrange
        work.config.includeDestructive = '.sgdincludedestructive'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockProcess).not.toBeCalled()
      })
    })

    describe('when file matches the patterns', () => {
      beforeEach(() => {
        mockKeep.mockReturnValue(false)
      })
      it('process include destructive', async () => {
        // Arrange
        work.config.includeDestructive = '.sgdincludedestructive'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockProcess).toBeCalled()
      })
    })
  })
})
