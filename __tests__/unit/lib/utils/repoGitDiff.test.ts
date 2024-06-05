'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import type { Config } from '../../../../src/types/config'
import { IgnoreHelper } from '../../../../src/utils/ignoreHelper'
import RepoGitDiff from '../../../../src/utils/repoGitDiff'
import { getGlobalMetadata } from '../../../__utils__/globalTestHelper'

const mockGetDiffLines = jest.fn()
jest.mock('../../../../src/adapter/GitAdapter', () => ({
  getInstance: jest.fn(() => ({
    getDiffLines: mockGetDiffLines,
  })),
}))

const mockKeep = jest.fn()
jest.spyOn(IgnoreHelper, 'getIgnoreInstance').mockResolvedValue({
  keep: mockKeep,
} as never)
mockKeep.mockReturnValue(true)

const FORCEIGNORE_MOCK_PATH = '__mocks__/.forceignore'

const TAB = '\t'

describe(`test if repoGitDiff`, () => {
  let globalMetadata: MetadataRepository
  let config: Config
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    config = {
      to: '',
      from: '',
      output: '',
      source: '',
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
  it('can parse git correctly', async () => {
    const output: string[] = []
    mockGetDiffLines.mockImplementation(() => Promise.resolve([]))
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreWhitespace = true
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  it('can parse git permissively', async () => {
    const output: string[] = []
    mockGetDiffLines.mockImplementation(() => Promise.resolve([]))
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  it('can resolve file deletion', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${DELETION}${TAB}${x}`))
    )
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${DELETION}${TAB}${x}`))
  })

  it('can resolve binary file deletion', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${DELETION}${TAB}${x}`))
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${DELETION}${TAB}${x}`))
  })

  it('can resolve file copy when new file is added', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${ADDITION}${TAB}${x}`))
  })

  it('can resolve file copy when new binary file is added', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${ADDITION}${TAB}${x}`))
  })

  it('can resolve file copy when file is modified', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `M${TAB}${x}`))
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${MODIFICATION}${TAB}${x}`))
  })

  it('can resolve file copy when binary file is modified', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `M${TAB}${x}`))
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${MODIFICATION}${TAB}${x}`))
  })

  it('can filter ignored files', async () => {
    const output = ['force-app/main/default/pages/test.page-meta.xml']
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter ignored destructive files', async () => {
    const output = ['force-app/main/default/pages/test.page-meta.xml']
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter ignored and ignored destructive files', async () => {
    const output = ['force-app/main/default/lwc/jsconfig.json']
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter deletion if only ignored is specified files', async () => {
    const output = ['force-app/main/default/pages/test.page-meta.xml']
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()

    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('cannot filter non deletion if only ignored destructive is specified files', async () => {
    const output = ['force-app/main/default/pages/test.page-meta.xml']
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )

    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [`${ADDITION}${TAB}${output}`]
    expect(work).toStrictEqual(expected)
  })

  it('can filter sub folders', async () => {
    const output = ['force-app/main/default/pages/test.page-meta.xml']
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockImplementation(() =>
      Promise.resolve(output.map(x => `${ADDITION}${TAB}${x}`))
    )
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter moved files', async () => {
    const output: string[] = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/account/domain/classes/Account.cls`,
    ]
    mockGetDiffLines.mockImplementation(() => Promise.resolve(output))
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [`${output[1]}`]
    expect(work).toStrictEqual(expected)
  })

  it('can filter case changed files', async () => {
    const output: string[] = [
      `${DELETION}${TAB}force-app/main/default/objects/Account/fields/TEST__c.field-meta.xml`,
      `${ADDITION}${TAB}force-app/main/default/objects/Account/fields/Test__c.field-meta.xml`,
    ]
    mockGetDiffLines.mockImplementation(() => Promise.resolve(output))
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [`${output[1]}`]
    expect(work).toStrictEqual(expected)
  })

  it('cannot filter renamed files', async () => {
    const output: string[] = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/main/default/classes/RenamedAccount.cls`,
    ]
    mockGetDiffLines.mockImplementation(() => Promise.resolve(output))
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  it('cannot filter same name file with different metadata', async () => {
    const output: string[] = [
      `${DELETION}${TAB}force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml`,
      `${ADDITION}${TAB}force-app/main/default/objects/Opportunity/fields/CustomField__c.field-meta.xml`,
    ]
    mockGetDiffLines.mockImplementation(() => Promise.resolve(output))
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  it('can reject in case of error', async () => {
    mockGetDiffLines.mockImplementation(() => Promise.reject(new Error('test')))
    try {
      const repoGitDiff = new RepoGitDiff(
        config,
        null as unknown as MetadataRepository
      )
      await repoGitDiff.getLines()
    } catch (e) {
      expect(e).toBeDefined()
    }
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
