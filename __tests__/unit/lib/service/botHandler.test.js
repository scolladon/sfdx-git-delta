'use strict'
const BotHandler = require('../../../../src/service/botHandler')
const metadataManager = require('../../../../src/metadata/metadataManager')
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
    diffs: { package: new Map(), destructiveChanges: new Map() },
  },
}

require('fs').__setMockFiles({
  'force-app/main/default/bots/TestBot/TestBot.bot-meta.xml': 'test',
  'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml': 'test',
})

// eslint-disable-next-line no-undef
describe('test BotHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    globalMetadata = await metadataManager.getDefinition('directoryName', 50)
  })

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
      expect(testContext.work.diffs.package.get('Bot')).toEqual(
        testContext.testData[0][2]
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
      expect(testContext.work.diffs.package.get('Bot')).toEqual(
        testContext.testData[0][2]
      )
    })
  })
})
