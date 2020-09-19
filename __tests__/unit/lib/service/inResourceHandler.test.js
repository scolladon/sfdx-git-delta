'use strict'
const InResource = require('../../../../lib/service/inResourceHandler')
jest.mock('fs')
jest.mock('fs-extra')

const testContext = {
  handler: InResource,
  testData: [
    [
      'staticresources',
      'force-app/main/default/staticresources/test/content',
      new Set(['test']),
    ],
    [
      'staticresources',
      'force-app/main/default/staticresources/resource.js',
      new Set(['resource']),
    ],
    [
      'staticresources',
      'force-app/main/default/staticresources/erase.resource-meta.xml',
      new Set(['erase']),
    ],
    [
      'waveTemplates',
      'force-app/main/default/waveTemplates/WaveTemplateTest/template-info.json',
      new Set(['WaveTemplateTest']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
describe('test inResourceHandler', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/staticresources/test/content': 'test',
      'force-app/main/default/staticresources/resource.resource-meta.xml':
        'resource',
      'force-app/main/default/waveTemplates/WaveTemplateTest/template-info.json':
        '{"test":"test"}',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)

  test('if deletion of sub element handle', () => {
    testContext.work.config.generateDelta = false
    const data = testContext.testData[1]
    require('fs').__setMockFiles({ [data[1]]: '' })
    const handler = new testContext.handler(
      `D       ${data[1]}`,
      data[0],
      testContext.work,
      // eslint-disable-next-line no-undef
      globalMetadata
    )
    handler.handle()
    expect([...testContext.work.diffs.package[data[0]]]).toEqual(
      expect.arrayContaining([...data[2]])
    )
  })
})
