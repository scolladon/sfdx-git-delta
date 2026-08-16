'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import BotHandler from '../../../../src/service/botHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { Metadata } from '../../../../src/types/metadata'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

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

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
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
      const sut = new BotHandler(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given bot version addition, When collect, Then the element own copy from the parent call survives alongside the Bot file copy (botHandler L21)', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new BotHandler(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert — a `copies = []` regression would discard the copy
      // super.collectAddition() already produced for the botVersion file
      // itself, leaving only the Bot file copy _collectCopyWithMetaFile
      // appends.
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('TestBot/v1.botVersion')
        )
      ).toBe(true)
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('TestBot.bot')
        )
      ).toBe(true)
    })

    it('Given bot version in nested folder, When collect, Then returns correct BotVersion and Bot manifests', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'A       force-app/main/default/bots/nested/TestBot/v1.botVersion-meta.xml',
        objectType,
        globalMetadata
      )
      const sut = new BotHandler(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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
    })

    it('Given bot file addition, When collect, Then returns only Bot manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'A       force-app/main/default/bots/TestBot/TestBot.bot-meta.xml',
        objectType,
        globalMetadata
      )
      const sut = new BotHandler(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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
