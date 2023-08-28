const IncludeProcessor = require('../../../../src/post-processor/includeProcessor')
const { buildIncludeHelper } = require('../../../../src/utils/ignoreHelper')

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

const mockKeep = jest.fn()
buildIncludeHelper.mockImplementation(() => ({
  keep: mockKeep,
}))

describe('IncludeProcessor', () => {
  let work
  let metadata

  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    metadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    work = {
      config: {},
      diffs: { package: new Map(), destructiveChanges: new Map() },
      warnings: [],
    }
    jest.clearAllMocks()
  })

  describe('when no include is configured', () => {
    it('does not process include', async () => {
      // Arrange
      const sut = new IncludeProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(buildIncludeHelper).not.toBeCalled()
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
        expect(buildIncludeHelper).toBeCalled()
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
        expect(buildIncludeHelper).toBeCalled()
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
        expect(buildIncludeHelper).toBeCalled()
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
        expect(buildIncludeHelper).toBeCalled()
        expect(mockProcess).toBeCalled()
      })
    })
  })
})
it('test', () => {})
