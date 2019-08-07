'use strict'
const Lightning = require('../../../../lib/service/lightningHandler')

const testContext = {
  handler: Lightning,
  testData: [
    [
      'lwc',
      'force-app/main/default/lwc/component/component.js-meta.xml',
      new Set(['component']),
    ],
    [
      'aura',
      'force-app/main/default/aura/component/component.cmp-meta.xml',
      new Set(['component']),
    ],
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: {},
    promises: [],
  },
}

testHandlerHelper(testContext)
