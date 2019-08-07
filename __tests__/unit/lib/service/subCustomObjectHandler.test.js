'use strict'
const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')

const testContext = {
  handler: SubCustomObject,
  testData: [
    [
      'fields',
      'force-app/main/default/Account/fields/awesome.field-meta.xml',
      new Set(['Account.awesome']),
    ],
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: {},
    promises: [],
  },
}

testHandlerHelper(testContext)
