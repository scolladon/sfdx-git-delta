'use strict'
const InFolder = require('../../../../src/service/inFolderHandler')
const fs = require('fs')
const fse = require('fs-extra')
jest.mock('fs')

// eslint-disable-next-line no-undef
testHandlerHelper({
  handler: InFolder,
  testData: [
    [
      'dashboards',
      'force-app/main/default/dashboards/folder/file.dashboard-meta.xml',
      new Set(['folder/file']),
    ],
    [
      'reports',
      'force-app/main/default/reports/folder.reportFolder-meta.xml',
      new Set(['folder']),
    ],
    [
      'documents',
      'force-app/main/default/documents/folder.documentFolder-meta.xml',
      new Set(['folder']),
    ],
    [
      'documents',
      'force-app/main/default/documents/folder/document.test.ext',
      new Set(['folder/document.test']),
    ],
    [
      'documents',
      'force-app/main/default/documents/folder/document.test.document-meta.xml',
      new Set(['folder/document.test']),
    ],
  ],
  work: {
    config: { output: '', repo: '.', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  },
})

// eslint-disable-next-line no-undef
testHandlerHelper({
  handler: InFolder,
  testData: [
    [
      'dashboards',
      'force-app/main/default/dashboards/folder/file.dashboard-meta.xml',
      new Set(['folder/file']),
    ],
  ],
  work: {
    config: { output: '', repo: './repo', generateDelta: false },
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  },
})

describe('InFolderHander', () => {
  let globalMetadata
  let work
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
    work = {
      config: { output: '', repo: '.', generateDelta: true },
      diffs: { package: new Map(), destructiveChanges: new Map() },
      warnings: [],
    }
  })
  test('copy special extension', async () => {
    fs.__setMockFiles({
      'force-app/main/default/documents/folder/test.document-meta.xml':
        'content',
      'force-app/main/default/documents/folder/test.png-meta.xml': 'content',
    })

    const handler = new InFolder(
      `M       force-app/main/default/documents/folder/test.document-meta.xml`,
      'documents',
      work,
      globalMetadata
    )
    await handler.handle()

    expect(work.diffs.package.get('documents')).toEqual(
      new Set(['folder/test'])
    )
    expect(fse.copy).toHaveBeenCalled()
  })
})
