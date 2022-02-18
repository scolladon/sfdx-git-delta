'use strict'
const metadataManager = require('../../src/metadata/metadataManager')

global.testHandlerHelper = testContext => {
  describe(`test if ${testContext.handler.name}`, () => {
    let globalMetadata
    beforeAll(async () => {
      globalMetadata = await metadataManager.getDefinition('directoryName', 50)
    })
    describe.each(testContext.testData)(
      'handles',
      (type, changePath, expected, expectedType) => {
        beforeEach(
          () =>
            (testContext.work.diffs = { package: {}, destructiveChanges: {} })
        )
        test('addition', async () => {
          const handler = new testContext.handler(
            `A       ${changePath}`,
            type,
            testContext.work,
            globalMetadata
          )
          await handler.handle()
          expect(testContext.work.diffs.package).toHaveProperty(
            expectedType ?? type,
            expected
          )
        })
        test('deletion', async () => {
          const handler = new testContext.handler(
            `D       ${changePath}`,
            type,
            testContext.work,
            globalMetadata
          )
          await handler.handle()
          expect(testContext.work.diffs.destructiveChanges).toHaveProperty(
            expectedType ?? type,
            expected
          )
        })
        test('modification', async () => {
          const handler = new testContext.handler(
            `M       ${changePath}`,
            type,
            testContext.work,
            globalMetadata
          )
          await handler.handle()
          expect(testContext.work.diffs.package).toHaveProperty(
            expectedType ?? type,
            expected
          )
        })
      }
    )
  })
}
