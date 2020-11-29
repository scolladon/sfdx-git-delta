'use strict'
const SubFolderElementHandler = require('../../../../src/service/subFolderElementHandler')
jest.mock('fs')

const testContext = {
  handler: SubFolderElementHandler,
  testData: [
    [
      'classes',
      'force-app/main/default/classes/controller.cls-meta.xml',
      new Set(['apexclass']),
    ],
    [
      'subFolderClasses',
      'force-app/main/default/classes/controllers/controller.cls-meta.xml',
      new Set(['apexclass']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)
