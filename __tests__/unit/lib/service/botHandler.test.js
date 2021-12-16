'use strict'
const BotHandler = require('../../../../src/service/botHandler')
jest.mock('fs')

const testContext = {
  handler: BotHandler,
  testData: [
    [
      'bots',
      'force-app/main/default/bots/TestBot/TestBot.bot-meta.xml',
      new Set(['TestBot']),
      'Bot',
    ],
    [
      'bots',
      'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml',
      new Set(['TestBot.v1']),
      'BotVersion',
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

require('fs').__setMockFiles({
  'force-app/main/default/bots/TestBot/TestBot.bot-meta.xml': 'test',
  'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml': 'test',
})

// eslint-disable-next-line no-undef
describe('test BotHandler', () => {
  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)

  describe('when adding a botVersion', () => {
    it('includes the related bot', () => {
      const handler = new BotHandler(
        `A       'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml`,
        'bots',
        testContext.work,
        // eslint-disable-next-line no-undef
        globalMetadata
      )
      handler.handle()
      expect(testContext.work.diffs.package).toHaveProperty(
        'Bot',
        new Set(['TestBot'])
      )
    })
  })

  describe('when modifying a botVersion', () => {
    it('includes the related bot', () => {
      const handler = new BotHandler(
        `M       'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml`,
        'bots',
        testContext.work,
        // eslint-disable-next-line no-undef
        globalMetadata
      )
      handler.handle()
      expect(testContext.work.diffs.package).toHaveProperty(
        'Bot',
        new Set(['TestBot'])
      )
    })
  })
})
