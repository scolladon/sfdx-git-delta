'use strict'
const InFolder = require('../../../../lib/service/inFolderHandler')

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
    config: { output: '', repo: '' },
    diffs: {},
    promises: [],
  },
}

testHandlerHelper(testContext)
