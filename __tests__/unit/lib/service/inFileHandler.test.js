'use strict'
const InFile = require('../../../../lib/service/inFileHandler')
jest.mock('fs')

const testContext = {
  handler: InFile,
  testData: [
    [
      'objects',
      'force-app/main/default/workflows/Account.workflow-meta.xml',
      new Set(['Account']),
    ],
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: { package: {}, destructiveChanges: {} },
    promises: [],
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)
