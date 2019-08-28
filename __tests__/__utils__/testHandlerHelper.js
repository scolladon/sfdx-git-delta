'use strict'

global.testHandlerHelper = testContext => {
  describe(`test if ${testContext.handler.name}`, () => {
    describe.each(testContext.testData)(
      'handles',
      (type, changePath, expected) => {
        beforeEach(() => (testContext.work.diffs = {}))
        test('addition', () => {
          const handler = new testContext.handler(
            `A       ${changePath}`,
            type,
            testContext.work
          )
          handler.handle()
        })
        test('deletion', () => {
          const handler = new testContext.handler(
            `D       ${changePath}`,
            type,
            testContext.work
          )
          handler.handle()
          expect(testContext.work.diffs).toHaveProperty(type, expected)
        })
        test('modification', () => {
          const handler = new testContext.handler(
            `M       ${changePath}`,
            type,
            testContext.work
          )
          handler.handle()
        })
      }
    )
  })
}
