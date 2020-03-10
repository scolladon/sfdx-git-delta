'use strict'
const StandardHandler = require('../../../../lib/service/standardHandler')
jest.mock('fs')

const testContext = {
  handler: StandardHandler,
  testData: [
    [
      'objects',
      'force-app/main/default/objects/Account/Account.object-meta.xml',
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
