'use strict'
const SubFolderElementHandler = require('../../../../src/service/subFolderElementHandler')
jest.mock('fs')

const testContext = {
  handler: SubFolderElementHandler,
  testData: [
    [
      'classes',
      'force-app/main/default/classes/Controller.cls-meta.xml',
      new Set(['Controller']),
      'classes',
    ],
    [
      'classes',
      'force-app/main/default/classes/controllers/Controller.cls-meta.xml',
      new Set(['Controller']),
      'classes',
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)
