'use strict'
const InFolder = require('../../../../src/service/inFolderHandler')
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
    diffs: { package: {}, destructiveChanges: {} },
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
    config: { output: '', repo: './repo', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
    warnings: [],
  },
})
