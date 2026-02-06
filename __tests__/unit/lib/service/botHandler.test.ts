'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BotHandler from '../../../../src/service/botHandler'
import { Metadata } from '../../../../src/types/metadata'
import type { Work } from '../../../../src/types/work'
import { copyFiles } from '../../../../src/utils/fsHelper'
import type { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')
const mockResolver = {
  resolve: async () => null,
} as unknown as MetadataBoundaryResolver

const objectType: Metadata = {
  directoryName: 'bots',
  inFolder: false,
  metaFile: true,
  content: [
    {
      suffix: 'bot',
      xmlName: 'Bot',
    },
    {
      suffix: 'botVersion',
      xmlName: 'BotVersion',
    },
  ],
}
const line =
  'A       force-app/main/default/bots/TestBot/v1.botVersion-meta.xml'

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('BotHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('when called for a bot', () => {
    it('should add the bot', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new BotHandler(
        'A       force-app/main/default/bots/TestBot/TestBot.bot-meta.xml',
        objectType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.package.get('Bot')).toEqual(new Set(['TestBot']))
      expect(work.diffs.package.get('BotVersion')).toBeUndefined()
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })

  describe('when called for a bot version', () => {
    describe('when called with generateDelta false', () => {
      it('should add the related bot', async () => {
        // Arrange
        work.config.generateDelta = false
        const sut = new BotHandler(
          line,
          objectType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get('Bot')).toEqual(new Set(['TestBot']))
        expect(work.diffs.package.get('BotVersion')).toEqual(
          new Set(['TestBot.v1'])
        )
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when called with generateDelta true', () => {
      it('should add and copy the related parent bot', async () => {
        const sut = new BotHandler(
          line,
          objectType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get('Bot')).toEqual(new Set(['TestBot']))
        expect(work.diffs.package.get('BotVersion')).toEqual(
          new Set(['TestBot.v1'])
        )
        expect(copyFiles).toHaveBeenCalledTimes(4)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          `force-app/main/default/bots/TestBot/v1.botVersion-meta.xml`
        )
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          `force-app/main/default/bots/TestBot/v1.botVersion`
        )
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          `force-app/main/default/bots/TestBot/TestBot.bot`
        )
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          `force-app/main/default/bots/TestBot/TestBot.bot-meta.xml`
        )
      })
    })
  })
})
