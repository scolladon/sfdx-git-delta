'use strict'
const InResource = require('../../../../lib/service/inResourceHandler')

// TODO follow tuto here

const testContext = {
  handler: InResource,
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

testHandlerHelper(testContext)
