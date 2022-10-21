'use strict'
const StandardHandler = require('../../../../src/service/standardHandler')
const { FSE_BIGINT_ERROR } = require('../../../../src/utils/fsHelper')
const mc = require('../../../../src/utils/metadataConstants')
const fse = require('fs-extra')
const fs = require('fs')
jest.mock('fs')
jest.mock('fs-extra')

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
    [
      'classes',
      'force-app/main/default/classes/controllers/Controller.cls-meta.xml',
      new Set(['Controller']),
    ],
    [
      'batchCalcJobDefinitions',
      'force-app/main/default/batchCalcJobDefinitions/Job.batchCalcJobDefinition-meta.xml',
      new Set(['Job']),
    ],
    [
      'restrictionRules',
      'force-app/main/default/restrictionRules/Account.rule-meta.xml',
      new Set(['Account']),
    ],
    [
      'objects',
      'force-app/main/default/objects/Test/Account/Account.object-meta.xml',
      new Set(['Account']),
    ],
    [
      'quickActions',
      'force-app/main/default/quickActions/Test/Account.New.quickAction-meta.xml',
      new Set(['Account.New']),
    ],
    [
      'quickActions',
      'force-app/main/default/quickActions/Test/NewGlobal.quickAction-meta.xml',
      new Set(['NewGlobal']),
    ],
    [
      'customMetadata',
      'force-app/main/default/customMetadata/Test/GraphicsPackImages.md_png.md-meta.xml',
      new Set(['GraphicsPackImages.md_png']),
    ],
    [
      'weblinks',
      'force-app/main/default/objects/Test/Account/weblinks/ClientStore.weblink-meta.xml',
      new Set(['ClientStore']),
    ],
    [
      'classes',
      'force-app/main/default/classes/Test/Controller.cls-meta.xml',
      new Set(['Controller']),
    ],
    [
      'restrictionRules',
      'force-app/main/default/restrictionRules/Test/Account.rule-meta.xml',
      new Set(['Account']),
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  },
}

describe(`standardHandler`, () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)

  test('without generate delta', async () => {
    testContext.work.config.generateDelta = false
    const handler = new testContext.handler(
      `A       ${testContext.testData[0][1]}`,
      testContext.testData[0][0],
      testContext.work,
      globalMetadata
    )
    await handler.handle()
    expect(
      testContext.work.diffs.package.get(testContext.testData[0][0])
    ).toEqual(testContext.testData[0][2])
  })

  test('do not handle not ADM line', async () => {
    const handler = new testContext.handler(
      `Z       ${testContext.testData[0][1]}`,
      testContext.testData[0][0],
      testContext.work,
      globalMetadata
    )
    await handler.handle()
  })

  test('do not handle treat meta file metadata non ending with meta suffix', async () => {
    const handler = new testContext.handler(
      `D       force-app/main/default/staticresources/test.resource${mc.METAFILE_SUFFIX}`,
      'staticresources',
      testContext.work,
      globalMetadata
    )
    await handler.handle()
  })

  test(`package member path delimiter is "${StandardHandler.PACKAGE_MEMBER_PATH_SEP}"`, () => {
    expect(
      StandardHandler.cleanUpPackageMember(`Package\\Member`).split(
        StandardHandler.PACKAGE_MEMBER_PATH_SEP
      ).length
    ).toBe(2)
  })

  test(`use fs.copySync when fse.copy "Source and destination must not be the same." special use cases`, async () => {
    testContext.work.config.generateDelta = true
    fse.copy.mockImplementationOnce(() =>
      Promise.reject({
        message: 'Other',
      })
    )
    fse.copy.mockImplementation(() =>
      Promise.reject({
        message: FSE_BIGINT_ERROR,
      })
    )
    const handler = new testContext.handler(
      `A       force-app/main/default/classes/test.cls`,
      'classes',
      testContext.work,
      globalMetadata
    )
    await handler.handle()
    expect(fse.copy).toHaveBeenCalled()
    expect(fse.copySync).toHaveBeenCalled()
    expect(fs.promises.copyFile).toHaveBeenCalled()
  })
})
