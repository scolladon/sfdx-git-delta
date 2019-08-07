'use strict'
const InResource = require('../../../../lib/service/inResourceHandler')

// TODO follow tuto here

const testContext = {
  handler: InResource,
  testData: [
    [
      'staticresources',
      'force-app/main/default/staticresources/resource.resource-meta.xml',
      {},
    ],
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: {},
    promises: [],
  },
}

testHandlerHelper(testContext)
