'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import type { Work } from '../../../../src/types/work'
import {
  buildIncludeHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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
