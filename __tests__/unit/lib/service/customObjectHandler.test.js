'use strict'
const CustomObjectHandler = require('../../../../lib/service/customObjectHandler')
const SubCustomObjectHandler = require('../../../../lib/service/subCustomObjectHandler')
jest.mock('fs')

const testContext = {
  handler: CustomObjectHandler,
  testData: [
    [
      'objects',
      'force-app/main/default/objects/Account/Account.object-meta.xml',
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
describe('test CustomObjectHandler', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/objects/Account/Account.object-meta.xml': 'test',
      'force-app/main/default/objects/Account/fields/test__c.field-meta.xml':
        SubCustomObjectHandler.MASTER_DETAIL_TAG,
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
