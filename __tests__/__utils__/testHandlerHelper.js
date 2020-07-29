'use strict'
const metadataManager = require('../../lib/metadata/metadataManager')

global.globalMetadata = metadataManager.getDefinition('directoryName', 49)
global.testHandlerHelper = testContext => {
  describe(`test if ${testContext.handler.name}`, () => {
    describe.each(testContext.testData)(
      'handles',
      (type, changePath, expected) => {
        beforeEach(
          () =>
            (testContext.work.diffs = { package: {}, destructiveChanges: {} })
        )
        test('addition', () => {
          const handler = new testContext.handler(
            `A       ${changePath}`,
            type,
            testContext.work,
            // eslint-disable-next-line no-undef
            globalMetadata
          )
          handler.handle()
        })
        test('deletion', () => {
          const handler = new testContext.handler(
            `D       ${changePath}`,
            type,
            testContext.work,
            // eslint-disable-next-line no-undef
            globalMetadata
          )
          handler.handle()
          expect(testContext.work.diffs.destructiveChanges).toHaveProperty(
            type,
            expected
          )
        })
        test('modification', () => {
          const handler = new testContext.handler(
            `M       ${changePath}`,
            type,
            testContext.work,
            // eslint-disable-next-line no-undef
            globalMetadata
          )
          handler.handle()
        })
      }
    )
  })
}
