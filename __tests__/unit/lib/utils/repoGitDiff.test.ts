'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Config } from '../../../../src/types/config'
import RepoGitDiff from '../../../../src/utils/repoGitDiff'

const mockGetDiffLines = vi.fn()
vi.mock('../../../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: vi.fn(() => ({
      getDiffLines: mockGetDiffLines,
    })),
  },
}))

const mockKeep = vi.fn()
vi.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: vi.fn(() => ({
    keep: mockKeep,
  })),
}))
mockKeep.mockReturnValue(true)

const FORCEIGNORE_MOCK_PATH = '__mocks__/.forceignore'

const TAB = '\t'

describe('Given a RepoGitDiff', () => {
  let globalMetadata: MetadataRepository
  let config: Config
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    config = {
      to: '',
      from: '',
      output: '',
      source: [''],
      ignore: '',
      ignoreDestructive: '',
      apiVersion: 0,
      repo: '',
      ignoreWhitespace: false,
      generateDelta: false,
      include: '',
      includeDestructive: '',
    }
  })
  it('Given empty diff and ignoreWhitespace, When getLines, Then returns empty', async () => {
    // Arrange
    mockGetDiffLines.mockResolvedValue([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreWhitespace = true
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given empty diff without ignoreWhitespace, When getLines, Then returns empty', async () => {
    // Arrange
    mockGetDiffLines.mockResolvedValue([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given deleted file, When getLines, Then returns deletion line', async () => {
    // Arrange
    const filePath =
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
    mockGetDiffLines.mockResolvedValue([`${DELETION}${TAB}${filePath}`])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([`${DELETION}${TAB}${filePath}`])
  })

  it('Given added file, When getLines, Then returns addition line', async () => {
    // Arrange
    const filePath =
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
    mockGetDiffLines.mockResolvedValue([`${ADDITION}${TAB}${filePath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([`${ADDITION}${TAB}${filePath}`])
  })

  it('Given modified file, When getLines, Then returns modification line', async () => {
    // Arrange
    const filePath =
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
    mockGetDiffLines.mockResolvedValue([`M${TAB}${filePath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([`${MODIFICATION}${TAB}${filePath}`])
  })

  it('Given ignored file, When getLines, Then filters it out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockResolvedValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given ignored destructive file, When getLines, Then filters it out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockResolvedValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given both ignore and ignoreDestructive, When getLines, Then filters matching files', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockResolvedValue([
      `${ADDITION}${TAB}force-app/main/default/lwc/jsconfig.json`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given ignore set, When file matches ignore, Then filters it out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockResolvedValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given only ignoreDestructive set, When non-deletion added, Then keeps it', async () => {
    // Arrange
    const filePath = 'force-app/main/default/pages/test.page-meta.xml'
    mockGetDiffLines.mockResolvedValue([`${ADDITION}${TAB}${filePath}`])
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([`${ADDITION}${TAB}${filePath}`])
  })

  it('Given ignored subfolder files, When getLines, Then filters them out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockResolvedValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given moved file (same name different folder), When getLines, Then filters deletion and keeps addition', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/account/domain/classes/Account.cls`,
    ]
    mockGetDiffLines.mockResolvedValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([lines[1]])
  })

  it('Given case-changed file, When getLines, Then filters deletion and keeps addition', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/objects/Account/fields/TEST__c.field-meta.xml`,
      `${ADDITION}${TAB}force-app/main/default/objects/Account/fields/Test__c.field-meta.xml`,
    ]
    mockGetDiffLines.mockResolvedValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual([lines[1]])
  })

  it('Given truly renamed file, When getLines, Then keeps both lines', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/main/default/classes/RenamedAccount.cls`,
    ]
    mockGetDiffLines.mockResolvedValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual(lines)
  })

  it('Given same name in different parent, When getLines, Then keeps both lines', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml`,
      `${ADDITION}${TAB}force-app/main/default/objects/Opportunity/fields/CustomField__c.field-meta.xml`,
    ]
    mockGetDiffLines.mockResolvedValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual(lines)
  })

  it('Given multiple files with same change type, When getLines, Then returns all', async () => {
    // Arrange
    const lines = [
      `${ADDITION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/main/default/classes/Contact.cls`,
    ]
    mockGetDiffLines.mockResolvedValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await sut.getLines()

    // Assert
    expect(result).toStrictEqual(lines)
  })

  it('can reject in case of error', async () => {
    // Arrange
    mockGetDiffLines.mockImplementation(() => Promise.reject(new Error('test')))
    const sut = new RepoGitDiff(config, null as unknown as MetadataRepository)

    // Act & Assert
    await expect(sut.getLines()).rejects.toThrow()
  })

  it('filters empty lines', async () => {
    // Arrange
    mockGetDiffLines.mockResolvedValue([
      '',
      `${ADDITION}${TAB}force-app/main/default/classes/Account.cls`,
      '',
    ])
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const work = await sut.getLines()

    // Assert
    expect(work).toHaveLength(1)
  })

  it('groups lines by diff type for rename detection', async () => {
    // Arrange
    const output: string[] = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${MODIFICATION}${TAB}force-app/main/default/classes/Other.cls`,
      `${ADDITION}${TAB}force-app/account/domain/classes/Account.cls`,
    ]
    mockGetDiffLines.mockResolvedValue(output)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const work = await sut.getLines()

    // Assert
    // Deletion of Account.cls should be filtered (moved), but Modification and Addition kept
    expect(work).toHaveLength(2)
    expect(work).toContain(output[1])
    expect(work).toContain(output[2])
  })

  describe('_extractComparisonName', () => {
    let sut: RepoGitDiff
    beforeEach(() => {
      sut = new RepoGitDiff(config, globalMetadata)
    })
    describe('when called with normal type', () => {
      it('returns the file name', () => {
        // Arrange
        const line = 'A path/to/classes/Test.cls'

        // Act
        const result = sut['_extractComparisonName'](line)

        // Assert
        expect(result).toBe('test.cls')
      })
    })

    describe.each([
      'objects/Account/fields/custom__c.field',
      'objects/custom__c/custom__c.object',
      'objectTranslations/Account/custom__c.objectTranslation',
    ])('when called with path type', elPath => {
      it('returns the file name with the parent path', () => {
        // Arrange
        const line = `A path/to/${elPath}`

        // Act
        const result = sut['_extractComparisonName'](line)

        // Assert
        expect(result).toBe(elPath.replace(/\//g, '').toLocaleLowerCase())
      })
    })
  })
})
