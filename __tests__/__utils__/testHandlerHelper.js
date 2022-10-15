'use strict'
const {
  getDefinition,
  getLatestSupportedVersion,
} = require('../../src/metadata/metadataManager')

const getMetadata = async () => {
  const apiVersion = await getLatestSupportedVersion()
  const metadata = await getDefinition('directoryName', apiVersion)
  return metadata
}

global.getGlobalMetadata = getMetadata

global.testHandlerHelper = testContext => {
  describe(`test if ${testContext.handler.name}`, () => {
    let globalMetadata
    beforeAll(async () => {
      globalMetadata = await getMetadata()
    })
    describe.each(testContext.testData)(
      'handles',
      (type, changePath, expected, expectedType) => {
        beforeEach(
          () =>
            (testContext.work.diffs = {
              package: new Map(),
              destructiveChanges: new Map(),
            })
        )
        test('addition', async () => {
          const handler = new testContext.handler(
            `A       ${changePath}`,
            type,
            testContext.work,
            globalMetadata
          )
          await handler.handle()
          expect(
            testContext.work.diffs.package.get(expectedType ?? type)
          ).toEqual(expected)
        })
        test('deletion', async () => {
          const handler = new testContext.handler(
            `D       ${changePath}`,
            type,
            testContext.work,
            globalMetadata
          )
          await handler.handle()
          expect(
            testContext.work.diffs.destructiveChanges.get(expectedType ?? type)
          ).toEqual(expected)
        })
        test('modification', async () => {
          const handler = new testContext.handler(
            `M       ${changePath}`,
            type,
            testContext.work,
            globalMetadata
          )
          await handler.handle()
          expect(
            testContext.work.diffs.package.get(expectedType ?? type)
          ).toEqual(expected)
        })
      }
    )
  })
}
