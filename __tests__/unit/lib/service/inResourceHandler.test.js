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
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: {},
    promises: [],
  },
}

// eslint-disable-next-line no-undef
describe('test inResourceHandler', () => {
  beforeAll(() => {
    require('fs').__setMockFiles({
      'force-app/main/default/staticresources/test/content': 'test',
    })
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
