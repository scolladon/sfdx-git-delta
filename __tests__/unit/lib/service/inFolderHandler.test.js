'use strict'
const InFolder = require('../../../../lib/service/inFolderHandler')
jest.mock('fs')

const testContext = {
  handler: InFolder,
  testData: [
    [
      'dashboards',
      'force-app/main/default/dashboards/folder/file.dashboard-meta.xml',
      new Set(['folder/file']),
    ],
  ],
  work: {
    config: { output: '', repo: '.' },
    diffs: { package: {}, destructiveChanges: {} },
    promises: [],
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)
