'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import StandardHandler from '../../../../src/service/standardHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles } from '../../../../src/utils/fsHelper'
import { Logger } from '../../../../src/utils/LoggingService'
import type { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')
const mockedCopyFiles = jest.mocked(copyFiles)
const mockResolver = {
  resolve: async () => null,
} as unknown as MetadataBoundaryResolver

const testSuitesType = {
  directoryName: 'testSuites',
  inFolder: false,
  metaFile: false,
  suffix: 'testSuite',
  xmlName: 'ApexTestSuite',
}
const classType = {
  directoryName: 'classes',
  inFolder: false,
  metaFile: true,
  suffix: 'cls',
  xmlName: 'ApexClass',
}
const entity = 'MyClass'
const basePath = 'force-app/main/default/'
const entityPath = `${basePath}${classType.directoryName}/${entity}.${classType.suffix}`

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe(`StandardHandler`, () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should catch errors silently and store them', async () => {
    // Arrange
    mockedCopyFiles.mockRejectedValueOnce(
      new Error('fatal: not a git repository')
    )
    const sut = new StandardHandler(
      `${ADDITION}       ${entityPath}`,
      classType,
      work,
      globalMetadata,
      mockResolver
    )

    // Act
    await sut.handle()

    // Assert
    expect(work.warnings.length).toEqual(1)
    expect(work.diffs.package.get(classType.xmlName)).toEqual(new Set([entity]))
    expect(work.diffs.destructiveChanges.size).toEqual(0)
    expect(copyFiles).toHaveBeenCalled()
  })

  it('should handle non-Error thrown values', async () => {
    // Arrange
    mockedCopyFiles.mockRejectedValueOnce('string error')
    const sut = new StandardHandler(
      `${ADDITION}       ${entityPath}`,
      classType,
      work,
      globalMetadata,
      mockResolver
    )

    // Act
    await sut.handle()

    // Assert
    expect(work.warnings.length).toEqual(1)
    expect(work.warnings[0].message).toContain('string error')
    expect(work.diffs.package.get(classType.xmlName)).toEqual(new Set([entity]))
  })

  it('does not handle not ADM line, silently', async () => {
    // Arrange
    const sut = new StandardHandler(
      `Z       ${entityPath}`,
      classType,
      work,
      globalMetadata,
      mockResolver
    )

    // Act
    await sut.handle()

    // Assert
    expect(work.warnings).toEqual([])
    expect(work.diffs.package.size).toEqual(0)
    expect(work.diffs.destructiveChanges.size).toEqual(0)
    expect(copyFiles).not.toHaveBeenCalled()
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
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.get(classType.xmlName)).toEqual(
        new Set([entity])
      )
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(copyFiles).not.toHaveBeenCalled()
    })
    it('should add deleted element to destructiveChanges', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${DELETION}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.get(classType.xmlName)).toEqual(
        new Set([entity])
      )
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })

  describe('when generating delta', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })

    describe('when file copy is not delegated', () => {
      it('should not copy files when _copyWithMetaFile check fails', async () => {
        // Arrange
        const sut = new StandardHandler(
          `${ADDITION}       ${entityPath}`,
          classType,
          work,
          globalMetadata,
          mockResolver
        )
        jest
          .spyOn(
            sut as unknown as { _delegateFileCopy: () => boolean },
            '_delegateFileCopy'
          )
          .mockReturnValue(false)

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.get(classType.xmlName)).toEqual(
          new Set([entity])
        )
        expect(copyFiles).not.toHaveBeenCalled()
      })

      it('should not copy files when _copy check fails', async () => {
        // Arrange
        const sut = new StandardHandler(
          `${ADDITION}       ${entityPath}`,
          classType,
          work,
          globalMetadata,
          mockResolver
        )
        jest
          .spyOn(
            sut as unknown as { _delegateFileCopy: () => boolean },
            '_delegateFileCopy'
          )
          .mockReturnValueOnce(true) // _copyWithMetaFile check passes
          .mockReturnValue(false) // _copy checks fail

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.get(classType.xmlName)).toEqual(
          new Set([entity])
        )
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when element type definition has meta file', () => {
      it('should add element to package when meta file is modified', async () => {
        // Arrange
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}${METAFILE_SUFFIX}`,
          classType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get(classType.xmlName)).toEqual(
          new Set([entity])
        )
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toHaveBeenCalledWith(work.config, entityPath)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          entityPath.replace(METAFILE_SUFFIX, '')
        )
      })

      it('should copy meta file when element is modified', async () => {
        // Arrange
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}`,
          classType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get(classType.xmlName)).toEqual(
          new Set([entity])
        )
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toHaveBeenCalledWith(work.config, entityPath)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
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
          testSuitesType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get(testSuitesType.xmlName)).toEqual(
          new Set(['suite'])
        )
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledWith(work.config, entityPath)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining(METAFILE_SUFFIX)
        )
      })

      it('should not copy meta file when element is modified', async () => {
        // Arrange
        const entityPath = `${basePath}testSuites/suite.testSuite`
        const sut = new StandardHandler(
          `${MODIFICATION}       ${entityPath}`,
          testSuitesType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.warnings).toEqual([])
        expect(work.diffs.package.get('ApexTestSuite')).toEqual(
          new Set(['suite'])
        )
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(copyFiles).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledWith(work.config, entityPath)
        expect(copyFiles).not.toHaveBeenCalledWith(
          work.config,
          expect.stringContaining(METAFILE_SUFFIX)
        )
      })
    })

    it.each([
      ['new', ADDITION],
      ['modified', MODIFICATION],
    ])('should add %s element to package and copy file', async (_, changeType) => {
      // Arrange
      const sut = new StandardHandler(
        `${changeType}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.get(classType.xmlName)).toEqual(
        new Set([entity])
      )
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(copyFiles).toHaveBeenCalledWith(work.config, entityPath)
    })
    it('should add deleted element to destructiveChanges and do not copy file', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${DELETION}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.warnings).toEqual([])
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.get(classType.xmlName)).toEqual(
        new Set([entity])
      )
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })

  describe('_parseLine', () => {
    it.each([
      '.',
      '',
      'other',
    ])('should return path and name part of a line "%s"', repoPath => {
      // Arrange
      work.config.repo = repoPath
      const sut = new StandardHandler(
        `${basePath}${classType.directoryName}/${entity}.${classType.suffix}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      const result: RegExpMatchArray = sut['_parseLine']()!

      // Assert
      expect(result.length).toBe(3)
      expect(result[0]).toBe(`${entityPath}`)
      expect(result[1]).toBe(`${basePath}${classType.directoryName}`)
      expect(result[2]).toBe(`${entity}.${classType.suffix}`)
    })

    it('should cache and reuse regex on subsequent calls', () => {
      // Arrange
      const sut = new StandardHandler(
        `${basePath}${classType.directoryName}/${entity}.${classType.suffix}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      const firstResult = sut['_parseLine']()
      const secondResult = sut['_parseLine']()

      // Assert
      expect(firstResult).toEqual(secondResult)
      expect(sut['lineRegex']).toBeDefined()
    })
  })

  describe('when the line should not be processed', () => {
    it.each([
      `force-app/main/default/classes/folder/Random.file`,
    ])('does not handle the line', async entityPath => {
      // Arrange
      const sut = new StandardHandler(
        `A       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.size).toBe(0)
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })

  describe('toString', () => {
    it('should return a string representation of the handler', () => {
      // Arrange
      const sut = new StandardHandler(
        `${ADDITION}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      const result = sut.toString()

      // Assert
      expect(result).toBe(
        `${sut.constructor.name}: ${sut['changeType']} -> ${sut['line']}`
      )
    })
  })

  describe('when logging is enabled', () => {
    let mockInfo: jest.Mock
    let originalCoreLogger: (typeof Logger)['coreLogger']

    beforeEach(() => {
      originalCoreLogger = Logger['coreLogger']
      mockInfo = jest.fn()
      Logger['coreLogger'] = {
        setLevel: jest.fn(),
        shouldLog: jest.fn().mockReturnValue(true),
        debug: jest.fn(),
        error: jest.fn(),
        info: mockInfo,
        trace: jest.fn(),
        warn: jest.fn(),
      } as unknown as (typeof Logger)['coreLogger']
    })

    afterEach(() => {
      Logger['coreLogger'] = originalCoreLogger
    })

    it('should log addition with lazy evaluated element name', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${ADDITION}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(mockInfo).toHaveBeenCalledWith(
        `${classType.xmlName}.${entity} created`,
        undefined
      )
    })

    it('should log deletion with lazy evaluated element name', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${DELETION}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(mockInfo).toHaveBeenCalledWith(
        `${classType.xmlName}.${entity} deleted`,
        undefined
      )
    })

    it('should log modification with lazy evaluated element name', async () => {
      // Arrange
      const sut = new StandardHandler(
        `${MODIFICATION}       ${entityPath}`,
        classType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(mockInfo).toHaveBeenCalledWith(
        `${classType.xmlName}.${entity} modified`,
        undefined
      )
    })
  })
})
