'use strict'
const InFolder = require('../../../../src/service/inFolderHandler')
jest.mock('fs')

const testContext = {
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
      'force-app/main/default/documents/folder/document.ext',
      new Set(['folder/document']),
    ],
    [
      'documents',
      'force-app/main/default/documents/folder/document.document-meta.xml',
      new Set(['folder/document']),
    ],
  ],
  work: {
    config: { output: '', repo: '.', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)
