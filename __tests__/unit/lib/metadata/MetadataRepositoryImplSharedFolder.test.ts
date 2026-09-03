'use strict'
import { beforeEach, describe, expect, it } from 'vitest'

import { MetadataRepositoryImpl } from '../../../../src/metadata/MetadataRepositoryImpl'
import type { Metadata } from '../../../../src/types/metadata'

// The shared MetadataRepositoryImpl.test.ts fixture declares `botVersion`
// twice (once standalone, once inside VirtualBot's content), which marks the
// suffix UNSAFE and makes every lookup fall through to the `bots` directory
// entry — proving nothing about the clone this file targets. A registry
// supplied through `--additional-metadata-registry-path` can hold the
// shared-folder type on its own, with no sibling declaring `botVersion`
// again, so `searchByExtension` resolves through the content clone before
// `searchByDirectory` is ever reached. That clone is built by
// `addSharedFolderSuffix`, which is exactly the code this file exercises.
describe('Given a shared-folder type reached through its content suffix', () => {
  let sut: MetadataRepositoryImpl

  beforeEach(() => {
    sut = new MetadataRepositoryImpl([
      {
        directoryName: 'bots',
        inFolder: false,
        metaFile: true,
        content: [
          { suffix: 'bot', xmlName: 'Bot' },
          { suffix: 'botVersion', xmlName: 'BotVersion' },
        ],
        xmlName: 'VirtualBot',
      } as Metadata,
    ])
  })

  it('When two same-named files under different folders are resolved, Then each answers with its own component name', () => {
    // Act
    const first = sut.getFullyQualifiedName('bots/MyBot/v1.botVersion-meta.xml')
    const second = sut.getFullyQualifiedName(
      'bots/OtherBot/v1.botVersion-meta.xml'
    )

    // Assert
    expect(first).toStrictEqual('bots/MyBot/v1.botVersion')
    expect(second).toStrictEqual('bots/OtherBot/v1.botVersion')
  })
})
