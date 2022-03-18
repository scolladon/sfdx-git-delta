'use strict'
const InResource = require('../../../../src/service/inResourceHandler')
const metadataManager = require('../../../../src/metadata/metadataManager')
jest.mock('fs')
jest.mock('fs-extra')
const fs = require('fs')
const fse = require('fs-extra')

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
    [
      'lwc',
      'force-app/main/default/lwc/component/component.js-meta.xml',
      new Set(['component']),
    ],
    [
      'aura',
      'force-app/main/default/aura/component/component.cmp-meta.xml',
      new Set(['component']),
    ],
    [
      'experiences',
      'force-app/main/default/experiences/component/subfolder/file.json',
      new Set(['component']),
    ],
    [
      'experiences',
      'force-app/main/default/experiences/component-meta.xml',
      new Set(['component']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  },
}

describe('test inResourceHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    fse.pathShouldExist = false
    fs.__setMockFiles({
      'force-app/main/default/staticresources/test/content': 'test',
      'force-app/main/default/staticresources/resource.resource-meta.xml':
        'resource',
      'force-app/main/default/waveTemplates/WaveTemplateTest/template-info.json':
        '{"test":"test"}',
    })
    globalMetadata = await metadataManager.getDefinition('directoryName', 50)
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)

  test('if deletion of sub element handle', async () => {
    fse.pathShouldExist = true
    testContext.work.config.generateDelta = false
    const data = testContext.testData[1]
    fs.__setMockFiles({ [data[1]]: '' })
    const handler = new testContext.handler(
      `D       ${data[1]}`,
      data[0],
      testContext.work,
      globalMetadata
    )
    await handler.handle()
    expect([...testContext.work.diffs.package.get(data[0])]).toEqual(
      expect.arrayContaining([...data[2]])
    )
  })
})
