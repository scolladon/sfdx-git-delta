'use strict'
const StandardHandler = require('../../../../src/service/standardHandler')
const { METAFILE_SUFFIX } = require('../../../../src/utils/metadataConstants')
const {
  ADDITION,
  MODIFICATION,
  DELETION,
} = require('../../../../src/utils/gitConstants')
const { copyFiles } = require('../../../../src/utils/fsHelper')

jest.mock('../../../../src/utils/fsHelper')

const objectType = 'classes'
const entity = 'MyClass'
const extension = 'cls'
const basePath = 'force-app/main/default/'
const entityPath = `${basePath}${objectType}/${entity}.${extension}`

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', source: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
})

describe(`StandardHandler`, () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should catch errors silently and store them', async () => {
    // Arrange
    copyFiles.mockImplementationOnce(() =>
      Promise.reject(new Error('fatal: not a git repository'))
    )
    const sut = new StandardHandler(
      `${ADDITION}       ${entityPath}`,
      objectType,
      work,
      globalMetadata
    )

    // Act
    await sut.handle()

    // Assert
    expect(work.warnings.length).toEqual(1)
    expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
    expect(work.diffs.destructiveChanges.size).toEqual(0)
    expect(copyFiles).toBeCalled()
  })

  it('does not handle not ADM line, silently', async () => {
    // Arrange
    const sut = new StandardHandler(
      `Z       ${entityPath}`,
      objectType,
      work,
      globalMetadata
    )

    // Act
    await sut.handle()

    // Assert
    expect(work.warnings).toEqual([])
    expect(work.diffs.package.size).toEqual(0)
    expect(work.diffs.destructiveChanges.size).toEqual(0)
    expect(copyFiles).not.toBeCalled()
  })

  describe('when not generating delta', () => {
    beforeEach(() => {
      work.config.generateDelta = false
    })

    it.each([
      ['new', ADDITION],
      ['modified', MODIFICATION],
    ])('should add %s element to package', async (_, changeType) => {
      // Arrange
      const sut = new StandardHandler(
        `${changeType}       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(copyFiles).not.toBeCalled()
    })
    it('should add deleted element to destructiveChanges', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${DELETION}       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.get(objectType)).toEqual(
        new Set([entity])
      )
      expect(copyFiles).not.toBeCalled()
    })
  })

  describe('when generating delta', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })
    describe('when element type definition has meta file', () => {
      it('should add element to package when meta file is modified', async () => {
        // Arrange
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}${METAFILE_SUFFIX}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toBeCalledWith(work.config, entityPath, entityPath)
        expect(copyFiles).toBeCalledWith(
          work.config,
          entityPath.replace(METAFILE_SUFFIX, ''),
          entityPath.replace(METAFILE_SUFFIX, '')
        )
      })

      it('should copy meta file when element is modified', async () => {
        // Arrange
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toBeCalledWith(work.config, entityPath, entityPath)
        expect(copyFiles).toBeCalledWith(
          work.config,
          entityPath.replace(METAFILE_SUFFIX, ''),
          entityPath.replace(METAFILE_SUFFIX, '')
        )
      })
    })

    describe('when element type definition does not have side meta file (but can end by the meta suffix)', () => {
      it('should add element to package when meta file is modified', async () => {
        // Arrange
        const entityPath = `${basePath}testSuites/suite.testSuite${METAFILE_SUFFIX}`
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}`,
          'testSuites',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get('testSuites')).toEqual(new Set(['suite']))
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toBeCalledTimes(1)
        expect(copyFiles).toBeCalledWith(work.config, entityPath, entityPath)
        expect(copyFiles).toBeCalledWith(
          work.config,
          expect.stringContaining(METAFILE_SUFFIX),
          expect.stringContaining(METAFILE_SUFFIX)
        )
      })

      it('should not copy meta file when element is modified', async () => {
        // Arrange
        const entityPath = `${basePath}testSuites/suite.testSuite`
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}`,
          'testSuites',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get('testSuites')).toEqual(new Set(['suite']))
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toBeCalledTimes(1)
        expect(copyFiles).toBeCalledWith(work.config, entityPath, entityPath)
        expect(copyFiles).not.toBeCalledWith(
          work.config,
          expect.stringContaining(METAFILE_SUFFIX),
          expect.stringContaining(METAFILE_SUFFIX)
        )
      })
    })

    it.each([
      ['new', ADDITION],
      ['modified', MODIFICATION],
    ])(
      'should add %s element to package and copy file',
      async (_, changeType) => {
        // Arrange
        const sut = new StandardHandler(
          `${changeType}       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get(objectType)).toEqual(new Set([entity]))
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toBeCalledWith(work.config, entityPath, entityPath)
      }
    )
    it('should add deleted element to destructiveChanges and do not copy file', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${DELETION}       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.get(objectType)).toEqual(
        new Set([entity])
      )
      expect(copyFiles).not.toBeCalled()
    })
  })

  describe('_parseLine', () => {
    it.each(['.', '', 'other'])(
      'should return repo, path and name part of a line with config.repo "%s"',
      repoPath => {
        // Arrange
        work.config.repo = repoPath
        const sut = new StandardHandler(
          `${MODIFICATION}       ${basePath}${objectType}/${entity}.${extension}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        const result = sut._parseLine()

        // Assert
        expect(result.length).toBe(4)
        expect(result[0]).toBe(
          `${!['', '.'].includes(repoPath) ? `${repoPath}/` : ''}${entityPath}`
        )
        expect(result[1]).toBe(['', '.'].includes(repoPath) ? '' : repoPath)
        expect(result[2]).toBe(
          `${!['', '.'].includes(repoPath) ? '/' : ''}${basePath}${objectType}`
        )
        expect(result[3]).toBe(`${entity}.${extension}`)
      }
    )
  })
})

describe('cleanUpPackageMember', () => {
  it(`package member path delimiter is "${StandardHandler.PACKAGE_MEMBER_PATH_SEP}"`, () => {
    // Arrange
    const example = `Package\\Member`

    // Act
    const result = StandardHandler.cleanUpPackageMember(example).split(
      StandardHandler.PACKAGE_MEMBER_PATH_SEP
    )

    // Assert
    expect(result.length).toBe(2)
  })
})
