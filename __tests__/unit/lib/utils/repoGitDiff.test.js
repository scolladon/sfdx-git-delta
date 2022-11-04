'use strict'
const RepoGitDiff = require('../../../../src/utils/repoGitDiff')
const {
  ADDITION,
  DELETION,
  MODIFICATION,
} = require('../../../../src/utils/gitConstants')
jest.mock('child_process')
const child_process = require('child_process')

const FORCEIGNORE_MOCK_PATH = '__mocks__/.forceignore'
const FORCEINCLUDE_MOCK_PATH = '__mocks__/.forceinclude'

const TAB = '\t'

describe(`test if repoGitDiff`, () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    child_process.__setOutput([])
    child_process.__setError(false)
  })
  test('can parse git correctly', async () => {
    const output = []
    child_process.__setOutput([output])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  test('can parse git permissively', async () => {
    const output = []
    child_process.__setOutput([output])
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        ignore: FORCEIGNORE_MOCK_PATH,
        ignoreWhitespace: true,
      },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output)
  })

  test('can resolve file deletion', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.__setOutput([[], output.map(x => `1${TAB}1${TAB}${x}`), []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toStrictEqual(output.map(x => `${DELETION}${TAB}${x}`))
  })

  test('can resolve binary file deletion', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.__setOutput([[], output.map(x => `1${TAB}1${TAB}${x}`), []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toMatchObject(output.map(x => `${DELETION}${TAB}${x}`))
  })

  test('can resolve file copy when new file is added', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.__setOutput([[], [], output.map(x => `1${TAB}1${TAB}${x}`)])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toMatchObject(output.map(x => `${ADDITION}${TAB}${x}`))
  })

  test('can resolve file copy when new binary file is added', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.__setOutput([[], [], output.map(x => `-${TAB}-${TAB}${x}`)])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toMatchObject(output.map(x => `${ADDITION}${TAB}${x}`))
  })

  test('can resolve file copy when file is modified', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.__setOutput([output.map(x => `-${TAB}-${TAB}${x}`), [], []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toMatchObject(output.map(x => `${MODIFICATION}${TAB}${x}`))
  })

  test('can resolve file copy when binary file is modified', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    ]
    child_process.__setOutput([output.map(x => `-${TAB}-${TAB}${x}`), [], []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    expect(work).toMatchObject(output.map(x => `${MODIFICATION}${TAB}${x}`))
  })

  test('can filter ignored files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    child_process.__setOutput([[`1${TAB}1${TAB}${output}`], [], []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter ignored destructive files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    child_process.__setOutput([[], [`1${TAB}1${TAB}${output}`], []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignoreDestructive: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter ignored and ignored destructive files', async () => {
    const output = 'force-app/main/default/lwc/jsconfig.json'
    child_process.__setOutput([
      [],
      [`1${TAB}1${TAB}${output}`],
      [`1${TAB}1${TAB}${output}`],
    ])
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        ignore: FORCEIGNORE_MOCK_PATH,
        ignoreDestructive: FORCEIGNORE_MOCK_PATH,
      },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('cannot filter deletion if only ignored is specified files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    child_process.__setOutput([[], [`1${TAB}1${TAB}${output}`], []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()

    const expected = [`${DELETION}${TAB}${output}`]
    expect(work).toStrictEqual(expected)
  })

  test('cannot filter non deletion if only ignored destructive is specified files', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    child_process.__setOutput([[], [], [`1${TAB}1${TAB}${output}`]])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignoreDestructive: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = [`${ADDITION}${TAB}${output}`]
    expect(work).toStrictEqual(expected)
  })

  test('can filter sub folders', async () => {
    const output = 'force-app/main/default/pages/test.page-meta.xml'
    child_process.__setOutput([[`1${TAB}1${TAB}${output}`], [], []])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '', ignore: FORCEIGNORE_MOCK_PATH },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected = []
    expect(work).toStrictEqual(expected)
  })

  test('can filter moved files', async () => {
    const output = [
      'force-app/main/default/classes/Account.cls',
      'force-app/account/domain/classes/Account.cls',
    ]
    child_process.__setOutput([
      [],
      [`1${TAB}1${TAB}${output[0]}`],
      [`1${TAB}1${TAB}${output[1]}`],
    ])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = [`${ADDITION}${TAB}${output[1]}`]
    expect(work).toStrictEqual(expected)
  })

  test('can filter case changed files', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/TEST__c.field-meta.xml',
      'force-app/main/default/objects/Account/fields/Test__c.field-meta.xml',
    ]
    child_process.__setOutput([
      [],
      [`1${TAB}1${TAB}${output[0]}`],
      [`1${TAB}1${TAB}${output[1]}`],
    ])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = [`${ADDITION}${TAB}${output[1]}`]
    expect(work).toStrictEqual(expected)
  })

  test('cannot filter renamed files', async () => {
    const output = [
      'force-app/main/default/classes/Account.cls',
      'force-app/main/default/classes/RenamedAccount.cls',
    ]
    child_process.__setOutput([
      [],
      [`1${TAB}1${TAB}${output[0]}`],
      [`1${TAB}1${TAB}${output[1]}`],
    ])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = [
      `${ADDITION}${TAB}${output[1]}`,
      `${DELETION}${TAB}${output[0]}`,
    ]
    expect(work).toStrictEqual(expected)
  })

  test('cannot filter same name file with different metadata', async () => {
    const output = [
      'force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml',
      'force-app/main/default/objects/Opportunity/fields/CustomField__c.field-meta.xml',
    ]
    child_process.__setOutput([
      [],
      [`1${TAB}1${TAB}${output[0]}`],
      [`1${TAB}1${TAB}${output[1]}`],
    ])
    const repoGitDiff = new RepoGitDiff(
      { output: '', repo: '' },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = [
      `${ADDITION}${TAB}${output[1]}`,
      `${DELETION}${TAB}${output[0]}`,
    ]
    expect(work).toStrictEqual(expected)
  })

  test('can explicitly include files', async () => {
    const output = ['force-app/main/default/lwc/jsconfig.json']
    child_process.__setOutput([output, [], [], []])
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        include: FORCEINCLUDE_MOCK_PATH,
      },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = ['A      force-app/main/default/lwc/jsconfig.json']
    expect(work).toStrictEqual(expected)
  })

  test('can explicitly include destructive files', async () => {
    const output = ['force-app/main/default/lwc/jsconfig.json']
    child_process.__setOutput([output, [], [], []])
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        includeDestructive: FORCEINCLUDE_MOCK_PATH,
      },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = ['D      force-app/main/default/lwc/jsconfig.json']
    expect(work).toStrictEqual(expected)
  })

  test('can explicitly include multiple files', async () => {
    const output = [
      'force-app/main/default/lwc/jsconfig.json',
      'force-app/main/default/staticresources/jsconfig.json',
    ]
    child_process.__setOutput([output, [], [], []])
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        include: FORCEINCLUDE_MOCK_PATH,
      },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    //should be empty
    const expected = [
      'A      force-app/main/default/lwc/jsconfig.json',
      'A      force-app/main/default/staticresources/jsconfig.json',
    ]
    expect(work).toStrictEqual(expected)
  })

  test('can explicitly include destructive multiple files', async () => {
    const output = [
      'force-app/main/default/lwc/jsconfig.json',
      'force-app/main/default/staticresources/jsconfig.json',
    ]
    child_process.__setOutput([output, [], [], []])
    const repoGitDiff = new RepoGitDiff(
      {
        output: '',
        repo: '',
        includeDestructive: FORCEINCLUDE_MOCK_PATH,
      },
      globalMetadata
    )
    const work = await repoGitDiff.getLines()
    const expected = [
      `D      force-app/main/default/lwc/jsconfig.json`,
      'D      force-app/main/default/staticresources/jsconfig.json',
    ]
    expect(work).toStrictEqual(expected)
  })

  test('can reject in case of error', async () => {
    child_process.__setError(true)
    try {
      const repoGitDiff = new RepoGitDiff({ output: '', repo: '' }, null)
      await repoGitDiff.getLines()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})
