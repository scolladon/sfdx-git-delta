'use strict'
const metadataManager = require('../../../../src/metadata/metadataManager')
const SubCustomObject = require('../../../../src/service/subCustomObjectHandler')
jest.mock('fs')

const testContext = {
  handler: SubCustomObject,
  testData: [
    [
      'fields',
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
      new Set(['Account.awesome']),
    ],
    [
      'indexes',
      'force-app/main/default/objects/Account/indexes/awesome.index-meta.xml',
      new Set(['Account.awesome']),
    ],
    [
      'rules',
      'force-app/main/default/territory2Models/EU/rules/Location.territory2Rule-meta.xml',
      new Set(['EU.Location']),
    ],
    [
      'territories',
      'force-app/main/default/territory2Models/EU/territories/France.territory2-meta.xml',
      new Set(['EU.France']),
    ],
    [
      'fields',
      'force-app/main/default/objects/Test/Account/fields/awesome.field-meta.xml',
      new Set(['Account.awesome']),
    ],
    [
      'rules',
      'force-app/main/default/territory2Models/Test/EU/rules/Location.territory2Rule-meta.xml',
      new Set(['EU.Location']),
    ],
    [
      'territories',
      'force-app/main/default/territory2Models/Test/EU/territories/France.territory2-meta.xml',
      new Set(['EU.France']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)

test('field is not a master detail', async () => {
  const globalMetadata = await metadataManager.getDefinition(
    'directoryName',
    50
  )
  const handler = new testContext.handler(
    `A       ${testContext.testData[0][1]}`,
    testContext.testData[0][0],
    testContext.work,
    // eslint-disable-next-line no-undef
    globalMetadata
  )
  require('fs').__setMockFiles({ [testContext.testData[0][1]]: '' })

  await handler.handle()
  expect(testContext.work.diffs.package.get('fields')).toEqual(
    testContext.testData[0][2]
  )
})

test('field does not generate delta', async () => {
  testContext.work.config.generateDelta = false
  const globalMetadata = await metadataManager.getDefinition(
    'directoryName',
    50
  )
  const handler = new testContext.handler(
    `A       ${testContext.testData[0][1]}`,
    testContext.testData[0][0],
    testContext.work,
    // eslint-disable-next-line no-undef
    globalMetadata
  )
  require('fs').__setMockFiles({ [testContext.testData[0][1]]: '' })

  await handler.handle()
  expect(testContext.work.diffs.package.get('fields')).toEqual(
    testContext.testData[0][2]
  )
})
