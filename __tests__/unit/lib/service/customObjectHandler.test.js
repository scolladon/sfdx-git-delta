'use strict'
const CustomObjectHandler = require('../../../../src/service/customObjectHandler')
const metadataManager = require('../../../../src/metadata/metadataManager')
const { MASTER_DETAIL_TAG } = require('../../../../src/utils/metadataConstants')
const fse = require('fs-extra')
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
    diffs: { package: new Map(), destructiveChanges: new Map() },
  },
}

// eslint-disable-next-line no-undef
describe('customObjectHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    globalMetadata = await metadataManager.getDefinition('directoryName', 50)
  })
  // eslint-disable-next-line no-undef
  describe('test CustomObjectHandler with fields', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      require('fs').__setMockFiles({
        'force-app/main/default/objects/Account/Account.object-meta.xml':
          'test',
        'force-app/main/default/objects/Account/fields': '',
        'force-app/main/default/objects/Account/fields/test__c.field-meta.xml':
          MASTER_DETAIL_TAG,
        'force-app/main/default/objects/Test/Account/Account.object-meta.xml':
          'test',
        'force-app/main/default/objects/Test/Account/fields/no':
          MASTER_DETAIL_TAG,
      })
    })

    test('addition and masterdetail fields', async () => {
      const handler = new testContext.handler(
        'A       force-app/main/default/objects/Account/Account.object-meta.xml',
        'objects',
        testContext.work,
        globalMetadata
      )
      await handler.handle()
      expect(fse.copy).toBeCalled()
    })

    // eslint-disable-next-line no-undef
    testHandlerHelper(testContext)
  })

  // eslint-disable-next-line no-undef
  describe('test CustomObjectHandler without fields', () => {
    beforeEach(async () => {
      fse.pathShouldExist = false
      require('fs').__setMockFiles({
        'force-app/main/default/objects/Account/Account.object-meta.xml':
          'test',
        'force-app/main/default/objects/Test/Account/Account.object-meta.xml':
          'test',
      })
    })

    // eslint-disable-next-line no-undef
    testHandlerHelper(testContext)

    test('addition', async () => {
      const handler = new testContext.handler(
        'A       force-app/main/default/objects/Account/Account.object-meta.xml',
        'objects',
        testContext.work,
        globalMetadata
      )
      await handler.handle()
      expect(testContext.work.diffs.package.get('objects')).toEqual(
        testContext.testData[0][2]
      )
    })

    test('addition and do not generate delta', async () => {
      testContext.work.config.generateDelta = false
      const handler = new testContext.handler(
        'A       force-app/main/default/objects/Account/Account.object-meta.xml',
        'objects',
        testContext.work,
        globalMetadata
      )
      await handler.handle()
      expect(testContext.work.diffs.package.get('objects')).toEqual(
        testContext.testData[0][2]
      )
    })
  })
})
