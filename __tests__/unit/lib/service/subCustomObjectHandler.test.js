'use strict'
const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')
jest.mock('fs')

const testContext = {
  handler: SubCustomObject,
  testData: [
    [
      'fields',
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
      new Set(['Account.awesome']),
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
