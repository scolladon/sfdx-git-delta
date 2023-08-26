'use strict'
import { expect, describe, it } from '@jest/globals'
import {
  getDefinition,
  getInFileAttributes,
  getLatestSupportedVersion,
  getSharedFolderMetadata,
  isVersionSupported,
} from '../../../../src/metadata/metadataManager'
import { Metadata, MetadataRepository } from '../../../../src/types/metadata'

describe(`test if metadata`, () => {
  it('provide latest when apiVersion does not exist', async () => {
    let metadata = await getDefinition(0)
    expect(metadata).toBeDefined()
    expect(metadata.get('classes')).toBeDefined()
    expect(metadata.get('do not exist')).toBeFalsy()
  })

  it('has classes', async () => {
    const metadata = await getDefinition(58)
    expect(metadata.get('classes')).toBeDefined()
  })

  it('do not have do not exist', async () => {
    let metadata = await getDefinition(48)
    metadata = await getDefinition(46)
    expect(metadata).toBeDefined()
    expect(metadata.get('do not exist')).toBeFalsy()
  })

  it('getLatestSupportedVersion', async () => {
    let latestVersion = await getLatestSupportedVersion()
    expect(latestVersion).toBeDefined()
    expect(latestVersion).toEqual(expect.any(Number))
  })

  it('isVersionSupported', async () => {
    // Arrange
    const dataSet = [
      [40, false],
      [46, true],
      [52, true],
      [55, true],
    ]

    // Act & Assert
    for (const data of dataSet) {
      const result = await isVersionSupported(data[0] as number)
      expect(result).toEqual(data[1])
    }
  })

  it('getInFileAttributes', async () => {
    // Arrange
    const metadata = new Map([
      [
        'waveTemplates',
        {
          directoryName: 'waveTemplates',
          inFolder: true,
          metaFile: false,
          xmlName: 'WaveTemplateBundle',
        },
      ],
      [
        'alerts',
        {
          directoryName: 'workflows.alerts',
          inFolder: false,
          metaFile: false,
          parentXmlName: 'Workflow',
          xmlName: 'WorkflowAlert',
          xmlTag: 'alerts',
          key: 'fullName',
        },
      ],
      [
        'excluded',
        {
          directoryName: 'excluded',
          inFolder: false,
          metaFile: false,
          parentXmlName: 'Banished',
          xmlName: 'Excluded',
          xmlTag: 'excluded',
          key: 'other',
          excluded: true,
        },
      ],
    ])

    // Act
    let inFileAttributes = getInFileAttributes(metadata)

    // Assert
    expect(inFileAttributes.has('waveTemplates')).toBe(false)
    expect(inFileAttributes.has('excluded')).toBe(true)
    expect(inFileAttributes.has('alerts')).toBe(true)
    expect(inFileAttributes.get('alerts')).toEqual({
      xmlName: 'WorkflowAlert',
      key: 'fullName',
      excluded: false,
    })
    expect(inFileAttributes.get('excluded')).toEqual({
      xmlName: 'Excluded',
      key: 'other',
      excluded: true,
    })

    // Act
    let otherInFileAttributes = getInFileAttributes(metadata)

    // Assert
    expect(otherInFileAttributes).toBe(inFileAttributes)
  })

  it('getSharedFolderMetadata', async () => {
    // Arrange
    const metadata: MetadataRepository = new Map([
      [
        'waveTemplates',
        {
          directoryName: 'waveTemplates',
          inFolder: true,
          metaFile: false,
          xmlName: 'WaveTemplateBundle',
        } as Metadata,
      ],
      [
        'discovery',
        {
          directoryName: 'discovery',
          inFolder: false,
          metaFile: true,
          content: [
            {
              suffix: 'model',
              xmlName: 'DiscoveryAIModel',
            },
            {
              suffix: 'goal',
              xmlName: 'DiscoveryGoal',
            },
          ],
        } as Metadata,
      ],
    ])

    // Act
    const sharedFolderMetadata: Map<string, string> = getSharedFolderMetadata(
      metadata
    ) as Map<string, string>

    // Assert
    expect(sharedFolderMetadata.has('discovery')).toBe(false)
    expect(sharedFolderMetadata.has('goal')).toBe(true)
    expect(sharedFolderMetadata.has('model')).toBe(true)
    expect(sharedFolderMetadata.get('goal')).toEqual('DiscoveryGoal')
    expect(sharedFolderMetadata.get('model')).toEqual('DiscoveryAIModel')

    // Act
    const otherSharedFolderMetadata = getSharedFolderMetadata(metadata)

    // Assert
    expect(otherSharedFolderMetadata).toBe(sharedFolderMetadata)
  })
})
