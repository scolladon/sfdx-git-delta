'use strict'
const InTranslation = require('../../../../src/service/inTranslationHandler')
jest.mock('fs')
jest.mock('fs-extra')
const fs = require('fs')
const fse = require('fs-extra')

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
describe('test inTranslation with delta generation', () => {
  beforeAll(() => {
    fse.pathShouldExist = false
    fs.__setMockFiles({
      [testContext.testData[0][1]]: 'test',
      [testContext.testData[1][1]]: 'test',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})

// eslint-disable-next-line no-undef
describe('test inTranslation without delta generation', () => {
  beforeAll(() => {
    testContext.work.config.generateDelta = false
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
