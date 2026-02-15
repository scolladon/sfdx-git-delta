'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import type { Work } from '../../../../src/types/work'
import {
  buildIncludeHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/testWork'

const mockProcess = jest.fn()
jest.mock('../../../../src/service/diffLineInterpreter', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        process: mockProcess,
      }
    }),
  }
})

const mockGetFilesPath = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: jest.fn(() => ({
      getFilesPath: mockGetFilesPath,
      getFirstCommitRef: jest.fn(),
    })),
  },
}))

jest.mock('../../../../src/utils/ignoreHelper')
const mockedBuildIncludeHelper = jest.mocked(buildIncludeHelper)

const mockKeep = jest.fn()
mockedBuildIncludeHelper.mockResolvedValue({
  keep: mockKeep,
} as unknown as IgnoreHelper)

describe('IncludeProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getDefinition({})
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
      expect(mockedBuildIncludeHelper).not.toHaveBeenCalled()
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
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).not.toHaveBeenCalled()
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
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).toHaveBeenCalled()
      })
    })

    describe('when multiple files match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() =>
          Promise.resolve(['test1', 'test2'])
        )
        mockKeep.mockReturnValue(false)
      })
      it('process all matching files', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).toHaveBeenCalledTimes(2)
      })
    })

    describe('when only additions match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
        // Keep deletion lines, reject addition lines
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('D')) as typeof mockKeep)
      })
      it('process only additions', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).toHaveBeenCalledTimes(1)
      })
    })

    describe('when only deletions match the patterns', () => {
      beforeEach(() => {
        mockGetFilesPath.mockImplementation(() => Promise.resolve(['test']))
        // Keep addition lines, reject deletion lines
        mockKeep.mockImplementation(((line: string) =>
          line.startsWith('A')) as typeof mockKeep)
      })
      it('process only deletions', async () => {
        // Arrange
        work.config.include = '.sgdinclude'
        const sut = new IncludeProcessor(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).toHaveBeenCalledTimes(1)
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
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).not.toHaveBeenCalled()
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
        expect(mockedBuildIncludeHelper).toHaveBeenCalled()
        expect(mockProcess).toHaveBeenCalled()
      })
    })
  })
})
