'use strict'
const StandardHandler = require('../../../../src/service/standardHandler')
jest.mock('fs')

const testContext = {
  handler: StandardHandler,
  testData: [
    [
      'objects',
      'force-app/main/default/objects/Account/Account.object-meta.xml',
      new Set(['Account']),
    ],
    [
      'quickActions',
      'force-app/main/default/quickActions/Account.New.quickAction-meta.xml',
      new Set(['Account.New']),
    ],
    [
      'quickActions',
      'force-app/main/default/quickActions/NewGlobal.quickAction-meta.xml',
      new Set(['NewGlobal']),
    ],
    [
      'customMetadata',
      'force-app/main/default/customMetadata/GraphicsPackImages.md_png.md-meta.xml',
      new Set(['GraphicsPackImages.md_png']),
    ],
    [
      'weblinks',
      'force-app/main/default/objects/Account/weblinks/ClientStore.weblink-meta.xml',
      new Set(['ClientStore']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

// eslint-disable-next-line no-undef
testHandlerHelper(testContext)

test('do not handle not ADM line', () => {
  const handler = new testContext.handler(
    `Z       ${testContext.testData[0][1]}`,
    testContext.testData[0][0],
    testContext.work,
    // eslint-disable-next-line no-undef
    globalMetadata
  )
  handler.handle()
})

test('do not handle treat meta file metadata non ending with meta suffix', () => {
  const handler = new testContext.handler(
    `D       force-app/main/default/staticresources/test.resource${StandardHandler.METAFILE_SUFFIX}`,
    'staticresources',
    testContext.work,
    // eslint-disable-next-line no-undef
    globalMetadata
  )
  handler.handle()
})
