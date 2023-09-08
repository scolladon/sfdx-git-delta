'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import IncludeProcessor from '../../../../src/post-processor/includeProcessor'
import {
  IgnoreHelper,
  buildIncludeHelper,
} from '../../../../src/utils/ignoreHelper'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/types/metadata'

const mockProcess = jest.fn()
jest.mock('../../../../src/service/diffLineInterpreter', () => {
  return jest.fn().mockImplementation(() => {
    return {
      process: mockProcess,
    }
  })
})

const mockGetAllFilesAsLineStream = jest.fn()
jest.mock('../../../../src/utils/repoSetup', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getAllFilesAsLineStream: mockGetAllFilesAsLineStream,
      getFirstCommitRef: jest.fn(),
    }
  })
})

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
    // eslint-disable-next-line no-undef
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
      expect(mockedBuildIncludeHelper).not.toBeCalled()
    })
  })

  describe('when include is configured', () => {
    beforeAll(() => {
      mockGetAllFilesAsLineStream.mockImplementation(() => ['test'])
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
        expect(mockedBuildIncludeHelper).toBeCalled()
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
        expect(mockedBuildIncludeHelper).toBeCalled()
        expect(mockProcess).toBeCalled()
      })
    })
  })

  describe('when includeDestructive is configured', () => {
    beforeAll(() => {
      mockGetAllFilesAsLineStream.mockImplementation(() => ['test'])
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
        expect(mockedBuildIncludeHelper).toBeCalled()
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
        expect(mockedBuildIncludeHelper).toBeCalled()
        expect(mockProcess).toBeCalled()
      })
    })
  })
})
