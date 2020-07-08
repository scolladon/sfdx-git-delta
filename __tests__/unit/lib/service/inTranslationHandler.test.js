'use strict'
const InTranslation = require('../../../../lib/service/inTranslationHandler')
jest.mock('fs')
jest.mock('fs-extra')

const testContext = {
  handler: InTranslation,
  testData: [
    [
      'objectTranslations',
      'force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml',
      new Set(['Account-es']),
    ],
    [
      'objectTranslations',
      'force-app/main/default/objectTranslations/Account-es/BillingFloor__c.fieldTranslation-meta.xml',
      new Set(['Account-es']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
describe('test inTranslation', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml':
        'test',
      'force-app/main/default/objectTranslations/Account-es/BillingFloor__c.fieldTranslation-meta.xml':
        'test',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
