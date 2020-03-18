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
    diffs: { package: {}, destructiveChanges: {} },
    promises: [],
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)

test('field is not a master detail', () => {
  const handler = new testContext.handler(
    `A       ${testContext.testData[0][1]}`,
    testContext.testData[0][0],
    testContext.work,
    // eslint-disable-next-line no-undef
    globalMetadata
  )
  require('fs').__setMockFiles({ [testContext.testData[0][1]]: '' })
  handler.handle()
})
