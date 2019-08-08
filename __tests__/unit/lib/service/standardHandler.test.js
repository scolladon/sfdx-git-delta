'use strict'
const StandardHandler = require('../../../../lib/service/standardHandler')
jest.mock('fs')

const testContext = {
  handler: StandardHandler,
  testData: [
    [
      'objects',
      'force-app/main/default/objects/Account.object-meta.xml',
      new Set(['Account']),
    ],
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: {},
    promises: [],
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)
