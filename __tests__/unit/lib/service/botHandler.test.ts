'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BotHandler from '../../../../src/service/botHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { Metadata } from '../../../../src/types/metadata'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

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

  describe('collect', () => {
    it('Given bot version addition, When collect, Then returns BotVersion and parent Bot manifests', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new BotHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'BotVersion',
            member: 'TestBot.v1',
          }),
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Bot',
            member: 'TestBot',
          }),
        ])
      )
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('TestBot.bot')
        )
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given bot file addition, When collect, Then returns only Bot manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'A       force-app/main/default/bots/TestBot/TestBot.bot-meta.xml',
        objectType,
        globalMetadata
      )
      const sut = new BotHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Bot',
            member: 'TestBot',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })
  })
})
