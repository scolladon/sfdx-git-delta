'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata } from '../../../__utils__/globalTestHelper'
import { resetIgnoreInstance } from '../../../../src/utils/ignoreHelper'
import RepoGitDiff from '../../../../src/utils/repoGitDiff'
import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/utils/gitConstants'
import {
  getSpawnContent,
  getSpawnContentByLine,
} from '../../../../src/utils/childProcessUtils'
import { Config } from '../../../../src/types/config'
import { MetadataRepository } from '../../../../src/types/metadata'

jest.mock('../../../../src/utils/childProcessUtils', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actualModule: any = jest.requireActual(
    '../../../../src/utils/childProcessUtils'
  )
  return {
    ...actualModule,
    getSpawnContent: jest.fn(),
    getSpawnContentByLine: jest.fn(),
  }
})

const mockedGetSpawContent = jest.mocked(getSpawnContent)
const mockedGetSpawContentByLine = jest.mocked(getSpawnContentByLine)

const FORCEIGNORE_MOCK_PATH = '__mocks__/.forceignore'

const TAB = '\t'

describe(`test if repoGitDiff`, () => {
  let globalMetadata: MetadataRepository
  let config: Config
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    resetIgnoreInstance()
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
    mockedGetSpawContentByLine.mockResolvedValue([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreWhitespace = true
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  it('can parse git permissively', async () => {
    const output: string[] = []
    mockedGetSpawContentByLine.mockResolvedValue([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  it('can resolve file deletion', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce(
      output.map(x => `1${TAB}1${TAB}${x}`)
    )
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${DELETION}${TAB}${x}`))
  })

  it('can resolve binary file deletion', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce(
      output.map(x => `1${TAB}1${TAB}${x}`)
    )
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${DELETION}${TAB}${x}`))
  })

  it('can resolve file copy when new file is added', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce(
      output.map(x => `1${TAB}1${TAB}${x}`)
    )
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${ADDITION}${TAB}${x}`))
  })

  it('can resolve file copy when new binary file is added', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce(
      output.map(x => `1${TAB}1${TAB}${x}`)
    )
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${ADDITION}${TAB}${x}`))
  })

  it('can resolve file copy when file is modified', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce(
      output.map(x => `1${TAB}1${TAB}${x}`)
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${MODIFICATION}${TAB}${x}`))
  })

  it('can resolve file copy when binary file is modified', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce(
      output.map(x => `1${TAB}1${TAB}${x}`)
    )
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${MODIFICATION}${TAB}${x}`))
  })

  it('can filter ignored files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter ignored destructive files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContent.mockResolvedValueOnce(
      Buffer.from(`1${TAB}1${TAB}${output}`)
    )
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter ignored and ignored destructive files', async () => {
    const output = 'force-app/main/default/lwc/jsconfig.json'
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContent.mockResolvedValueOnce(
      Buffer.from(`1${TAB}1${TAB}${output}`)
    )
    mockedGetSpawContent.mockResolvedValueOnce(
      Buffer.from(`1${TAB}1${TAB}${output}`)
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
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()

    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('cannot filter non deletion if only ignored destructive is specified files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])

    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [`${ADDITION}${TAB}${output}`]
    expect(work).toStrictEqual(expected)
  })

  it('can filter sub folders', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected: string[] = []
    expect(work).toStrictEqual(expected)
  })

  it('can filter moved files', async () => {
    const output: string[] = [
      'force-app/main/default/classes/Account.cls',
      'force-app/account/domain/classes/Account.cls',
    ]

    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[1]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[0]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [`${ADDITION}${TAB}${output[1]}`]
    expect(work).toStrictEqual(expected)
  })

  it('can filter case changed files', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/TEST__c.field-meta.xml',
      'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[1]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[0]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [`${ADDITION}${TAB}${output[1]}`]
    expect(work).toStrictEqual(expected)
  })

  it('cannot filter renamed files', async () => {
    const output: string[] = [
      'force-app/main/default/classes/Account.cls',
      'force-app/main/default/classes/RenamedAccount.cls',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[1]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[0]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [
      `${ADDITION}${TAB}${output[1]}`,
      `${DELETION}${TAB}${output[0]}`,
    ]
    expect(work).toStrictEqual(expected)
  })

  it('cannot filter same name file with different metadata', async () => {
    const output: string[] = [
      'force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml',
      'force-app/main/default/objects/Opportunity/fields/CustomField__c.field-meta.xml',
    ]
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[1]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([
      `1${TAB}1${TAB}${output[0]}`,
    ])
    mockedGetSpawContentByLine.mockResolvedValueOnce([])
    const repoGitDiff = new RepoGitDiff(config, globalMetadata)
    const work = await repoGitDiff.getLines()
    const expected: string[] = [
      `${ADDITION}${TAB}${output[1]}`,
      `${DELETION}${TAB}${output[0]}`,
    ]
    expect(work).toStrictEqual(expected)
  })

  it('can reject in case of error', async () => {
    mockedGetSpawContent.mockRejectedValue(new Error('test'))
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
        expect(result).toBe('Test.cls')
      })
    })

    describe.each([
      'objects/Account/fields/custom__c.field',
      'objects/Account/custom__c.object',
      'objectTranslations/Account/custom__c.objectTranslation',
    ])('when called with path type', elPath => {
      it('returns the file name with the parent path', () => {
        // Arrange
        const line = `A path/to/${elPath}`

        // Act
        const result = sut['_extractComparisonName'](line)

        // Assert
        expect(result).toBe(elPath.replace(/\//g, ''))
      })
    })
  })
})
