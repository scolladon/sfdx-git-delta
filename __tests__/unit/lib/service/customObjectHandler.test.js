'use strict'
const CustomObjectHandler = require('../../../../src/service/customObjectHandler')
const metadataManager = require('../../../../src/metadata/metadataManager')
const { MASTER_DETAIL_TAG } = require('../../../../src/utils/metadataConstants')
const { copy } = require('fs-extra')
jest.mock('fs')
jest.mock('fs-extra')

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
  let globalMetadata
  beforeEach(async () => {
    jest.clearAllMocks()
    require('fs').__setMockFiles({
      'force-app/main/default/objects/Account/Account.object-meta.xml': 'test',
      'force-app/main/default/objects/Account/fields': '',
      'force-app/main/default/objects/Account/fields/test__c.field-meta.xml':
        MASTER_DETAIL_TAG,
      'force-app/main/default/objects/Test/Account/Account.object-meta.xml':
        'test',
      'force-app/main/default/objects/Test/Account/fields/no':
        MASTER_DETAIL_TAG,
    })
    globalMetadata = await metadataManager.getDefinition('directoryName', 50)
  })

  test('addition and masterdetail fields', async () => {
    const handler = new testContext.handler(
      'A       force-app/main/default/objects/Account/Account.object-meta.xml',
      'objects',
      testContext.work,
      globalMetadata
    )
    await handler.handle()
    expect(copy).toBeCalled()
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})

// eslint-disable-next-line no-undef
describe('test CustomObjectHandler without fields', () => {
  beforeAll(async () => {
    require('fs').__setMockFiles({
      'force-app/main/default/objects/Account/Account.object-meta.xml': 'test',
      'force-app/main/default/objects/Test/Account/Account.object-meta.xml':
        'test',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
