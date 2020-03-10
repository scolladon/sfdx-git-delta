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
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: { package: {}, destructiveChanges: {} },
    promises: [],
  },
}

// eslint-disable-next-line no-undef
describe('test inResourceHandler', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/staticresources/test/content': 'test',
      'force-app/main/default/staticresources/resource.resource-meta.xml':
        'resource',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
