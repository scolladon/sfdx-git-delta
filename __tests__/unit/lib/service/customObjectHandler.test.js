'use strict'
const CustomObjectHandler = require('../../../../src/service/customObjectHandler')
const SubCustomObjectHandler = require('../../../../src/service/subCustomObjectHandler')
jest.mock('fs')

const testContext = {
  handler: CustomObjectHandler,
  testData: [
    [
      'objects',
      'force-app/main/default/objects/Account/Account.object-meta.xml',
      new Set(['Account']),
    ],
    [
      'objects',
      'force-app/main/default/objects/Test/Account/Account.object-meta.xml',
      new Set(['Account']),
    ],
    [
      'territory2Models',
      'force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
      new Set(['EU']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
describe('test CustomObjectHandler with fields', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/objects/Account/Account.object-meta.xml': 'test',
      'force-app/main/default/objects/Account/fields': '',
      'force-app/main/default/objects/Account/fields/test__c.field-meta.xml':
        SubCustomObjectHandler.MASTER_DETAIL_TAG,
      'force-app/main/default/objects/Test/Account/Account.object-meta.xml':
        'test',
      'force-app/main/default/objects/Test/Account/fields/test__c.field-meta.xml':
        SubCustomObjectHandler.MASTER_DETAIL_TAG,
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)

  test('addition', () => {
    testContext.work.config.generateDelta = false
    const handler = new testContext.handler(
      'A       force-app/main/default/objects/Account/Account.object-meta.xml',
      'objects',
      testContext.work,
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    handler.handle()
  })
})

// eslint-disable-next-line no-undef
describe('test CustomObjectHandler without fields', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/objects/Account/Account.object-meta.xml': 'test',
      'force-app/main/default/objects/Test/Account/Account.object-meta.xml':
        'test',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)

  test('addition', () => {
    testContext.work.config.generateDelta = false
    const handler = new testContext.handler(
      'A       force-app/main/default/objects/Account/Account.object-meta.xml',
      'objects',
      testContext.work,
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    handler.handle()
  })
})
