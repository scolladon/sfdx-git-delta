'use strict'
import { Ignore } from 'ignore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TreeIndexes } from '../../../../src/adapter/gitTreeLister'
import type { Config } from '../../../../src/types/config'
import type { Work } from '../../../../src/types/work'
import {
  contentIncludes,
  grepContentMatching,
  grepContentUnder,
  pathExists,
  readDirs,
  readPathFromGit,
  resetWrittenFiles,
  writeFile,
} from '../../../../src/utils/fsHelper'
import { outputFile } from '../../../../src/utils/fsUtils'
import {
  buildIgnoreHelper,
  IgnoreHelper,
} from '../../../../src/utils/ignoreHelper'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsUtils', async orig => ({
  ...(await orig<typeof import('../../../../src/utils/fsUtils')>()),
  outputFile: vi.fn(),
}))

vi.mock('../../../../src/utils/ignoreHelper')

vi.mock('../../../../src/utils/LoggingService')

import { Logger } from '../../../../src/utils/LoggingService'

const mockBuildIgnoreHelper = vi.mocked(buildIgnoreHelper)

const mockGetStringContent = vi.fn()
const mockGrepUnderPaths = vi.fn()
const mockGrepMatchingPathspecs = vi.fn()
vi.mock('../../../../src/adapter/GitAdapter', () => {
  return {
    default: {
      getInstance: () => ({
        getStringContent: mockGetStringContent,
        grepUnderPaths: mockGrepUnderPaths,
        grepMatchingPathspecs: mockGrepMatchingPathspecs,
      }),
    },
  }
})

// pathExists/readDirs no longer go through GitAdapter — they read the
// run-owned TreeIndexes holder directly. mockAt stands in for the holder's
// per-revision lookup, so tests can assert both which revision was asked
// for and what the resolved TreeIndex was asked to do.
const mockGetFilesPath = vi.fn()
const mockPathExists = vi.fn()
const mockAt = vi.fn(() => ({
  getFilesPath: mockGetFilesPath,
  pathExists: mockPathExists,
}))
const treeIndexes = { at: mockAt } as unknown as TreeIndexes

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  work = getWork()
  work.config.from = 'pastsha'
  work.config.to = 'recentsha'
})

describe('readPathFromGit', () => {
  describe.each([
    ['windows', 'force-app\\main\\default\\classes\\myClass.cls'],
    ['unix', 'force-app/main/default/classes/myClass.cls'],
  ])('when path is %s format', (_, path) => {
    beforeEach(() => {
      // Arrange
      mockGetStringContent.mockImplementation(() =>
        Promise.resolve(Buffer.from(''))
      )
    })

    it('returns the file content at `config.to` ref', async () => {
      // Act
      const forRef = { path, oid: work.config.to }
      await readPathFromGit(forRef, work.config)

      // Assert
      expect(mockGetStringContent).toHaveBeenCalledWith(forRef)
    })
  })

  describe.each([undefined, null])('when path contains "%s"', value => {
    beforeEach(() => {
      // Arrange
      mockGetStringContent.mockImplementation(() => Promise.resolve(value))
    })

    it('returns the file content at `config.to` ref', async () => {
      // Act
      const content = await readPathFromGit(
        { path: 'path/file', oid: work.config.to },
        work.config
      )

      // Assert
      expect(content).toBe(value)
    })
  })

  describe('when git adapter throws an error', () => {
    beforeEach(() => {
      // Arrange
      mockGetStringContent.mockImplementation(() =>
        Promise.reject(new Error('git error'))
      )
    })

    it('returns empty string and logs the error', async () => {
      // Act
      const content = await readPathFromGit(
        { path: 'path/file', oid: work.config.to },
        work.config
      )

      // Assert
      expect(content).toBe('')
    })

    it('When git adapter throws, Then Logger.debug is called (catch block body is not empty)', async () => {
      // Arrange — the BlockStatement {} mutant empties the catch body, which
      // means Logger.debug is never called. Asserting on it pins the catch body.
      const debugSpy = vi.spyOn(Logger, 'debug')

      // Act
      await readPathFromGit(
        { path: 'path/file', oid: work.config.to },
        work.config
      )

      // Assert — debug must have been called once for the error
      expect(debugSpy).toHaveBeenCalledOnce()
    })
  })
})

describe('readDirs', () => {
  describe('when path exist', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      mockGetFilesPath.mockImplementation(() => [`${dir}${file}`])
    })
    it('should return the file', async () => {
      // Act
      const dirContent = await readDirs(dir, work.config, treeIndexes)

      // Assert
      expect(dirContent).toEqual(expect.arrayContaining([`${dir}${file}`]))
      expect(mockGetFilesPath).toHaveBeenCalled()
    })

    it('should work with an array of paths', async () => {
      // Arrange
      const paths = ['dir1/', 'dir2/']
      mockGetFilesPath.mockImplementation(() => [
        'dir1/file1.js',
        'dir2/file2.js',
      ])

      // Act
      const dirContent = await readDirs(paths, work.config, treeIndexes)

      // Assert
      expect(dirContent).toEqual(
        expect.arrayContaining(['dir1/file1.js', 'dir2/file2.js'])
      )
      expect(mockAt).toHaveBeenCalledWith(work.config.to)
      expect(mockGetFilesPath).toHaveBeenCalledWith(paths)
    })
  })

  describe('when the revision has no built index', () => {
    it('returns an empty array without calling getFilesPath', async () => {
      // Arrange
      const unbuiltTreeIndexes = {
        at: () => undefined,
      } as unknown as TreeIndexes

      // Act
      const dirContent = await readDirs('dir', work.config, unbuiltTreeIndexes)

      // Assert
      expect(dirContent).toEqual([])
      expect(mockGetFilesPath).not.toHaveBeenCalled()
    })
  })
})

describe('pathExists', () => {
  it('returns true when path is folder', async () => {
    // Arrange
    mockPathExists.mockImplementation(() => true)

    // Act
    const result = await pathExists('path', work.config, treeIndexes)

    // Assert
    expect(result).toBe(true)
    expect(mockAt).toHaveBeenCalledWith(work.config.to)
    expect(mockPathExists).toHaveBeenCalledWith('path')
  })
  it('returns true when path is file', async () => {
    // Arrange
    mockPathExists.mockImplementation(() => true)

    // Act
    const result = await pathExists('path', work.config, treeIndexes)

    // Assert
    expect(result).toBe(true)
    expect(mockAt).toHaveBeenCalledWith(work.config.to)
    expect(mockPathExists).toHaveBeenCalledWith('path')
  })
  it('returns false when path does not exist', async () => {
    // Arrange
    mockPathExists.mockImplementation(() => false)

    // Act
    const result = await pathExists(
      'not/existing/path',
      work.config,
      treeIndexes
    )

    // Assert
    expect(result).toBe(false)
    expect(mockAt).toHaveBeenCalledWith(work.config.to)
    expect(mockPathExists).toHaveBeenCalledWith('not/existing/path')
  })

  describe('when the revision has no built index', () => {
    it('returns false without calling pathExists', async () => {
      // Arrange
      const unbuiltTreeIndexes = {
        at: () => undefined,
      } as unknown as TreeIndexes

      // Act
      const result = await pathExists('path', work.config, unbuiltTreeIndexes)

      // Assert
      expect(result).toBe(false)
      expect(mockPathExists).not.toHaveBeenCalled()
    })
  })
})

describe('grepContentUnder', () => {
  it('Given matching pattern, When grepContentUnder, Then returns matching paths and routes through grepUnderPaths only', async () => {
    // Arrange
    const matchingFiles = ['fields/Account.field', 'fields/Contact.field']
    mockGrepUnderPaths.mockImplementation(() => Promise.resolve(matchingFiles))

    // Act
    const result = await grepContentUnder('MasterDetail', 'fields', work.config)

    // Assert
    expect(result).toEqual(matchingFiles)
    expect(mockGrepUnderPaths).toHaveBeenCalledWith(
      'MasterDetail',
      'fields',
      work.config.to
    )
    expect(mockGrepMatchingPathspecs).not.toHaveBeenCalled()
  })

  it('Given no matches, When grepContentUnder, Then returns empty array', async () => {
    // Arrange
    mockGrepUnderPaths.mockImplementation(() => Promise.resolve([]))

    // Act
    const result = await grepContentUnder('nonexistent', 'fields', work.config)

    // Assert
    expect(result).toEqual([])
  })
})

describe('grepContentMatching', () => {
  it('Given multiple pathspecs, When grepContentMatching, Then passes the array to grepMatchingPathspecs only', async () => {
    // Arrange
    const matchingFiles = ['dir1/file1.xml', 'dir2/file2.xml']
    mockGrepMatchingPathspecs.mockImplementation(() =>
      Promise.resolve(matchingFiles)
    )

    // Act
    const result = await grepContentMatching(
      'flowDefinitions',
      ['dir1/*.xml', 'dir2/*.xml'],
      work.config
    )

    // Assert
    expect(result).toEqual(matchingFiles)
    expect(mockGrepMatchingPathspecs).toHaveBeenCalledWith(
      'flowDefinitions',
      ['dir1/*.xml', 'dir2/*.xml'],
      work.config.to
    )
    expect(mockGrepUnderPaths).not.toHaveBeenCalled()
  })

  it('Given no matches, When grepContentMatching, Then returns empty array', async () => {
    // Arrange
    mockGrepMatchingPathspecs.mockImplementation(() => Promise.resolve([]))

    // Act
    const result = await grepContentMatching(
      'nonexistent',
      'fields/*.xml',
      work.config
    )

    // Assert
    expect(result).toEqual([])
  })
})

describe('contentIncludes', () => {
  it('Given matching pattern, When contentIncludes, Then returns true and routes through grepUnderPaths only', async () => {
    // Arrange
    mockGrepUnderPaths.mockImplementation(() =>
      Promise.resolve(['fields/Account.field'])
    )

    // Act
    const result = await contentIncludes('MasterDetail', 'fields', work.config)

    // Assert
    expect(result).toBe(true)
    expect(mockGrepMatchingPathspecs).not.toHaveBeenCalled()
  })

  it('Given no matches, When contentIncludes, Then returns false', async () => {
    // Arrange
    mockGrepUnderPaths.mockImplementation(() => Promise.resolve([]))

    // Act
    const result = await contentIncludes('nonexistent', 'fields', work.config)

    // Assert
    expect(result).toBe(false)
  })
})

describe('writeFile', () => {
  beforeEach(() => {
    mockBuildIgnoreHelper.mockResolvedValue({
      globalIgnore: {
        ignores: () => false,
      } as unknown as Ignore,
    } as unknown as IgnoreHelper)
  })
  it('write the content to the file system', async () => {
    // Arrange
    const path = 'folder/file'
    const config: Config = work.config
    config.output = 'root'
    const content = 'content'

    // Act
    await writeFile(path, content, config)

    // Assert
    expect(outputFile).toHaveBeenCalledWith('root/folder/file', content)
  })

  it('call only once for the same path', async () => {
    // Arrange
    const config: Config = work.config
    config.output = 'root'
    const content = 'content'
    const path = 'other/path/file'
    await writeFile(path, content, config)

    // Act
    await writeFile(path, content, config)

    // Assert
    expect(outputFile).toHaveBeenCalledTimes(1)
  })

  it('should not copy ignored path', async () => {
    // Arrange
    mockBuildIgnoreHelper.mockResolvedValue({
      globalIgnore: {
        ignores: () => true,
      } as unknown as Ignore,
    } as unknown as IgnoreHelper)

    // Act
    await writeFile('', '', {} as Config)

    // Assert
    expect(outputFile).not.toHaveBeenCalled()
  })

  it('Given resetWrittenFiles called, When writing same path twice, Then outputFile is called twice', async () => {
    // Arrange
    const path = 'reset/path/file'
    const config: Config = work.config
    config.output = 'root'
    const content = 'content'
    await writeFile(path, content, config)

    // Act
    resetWrittenFiles()
    await writeFile(path, content, config)

    // Assert
    expect(outputFile).toHaveBeenCalledTimes(2)
  })
})
