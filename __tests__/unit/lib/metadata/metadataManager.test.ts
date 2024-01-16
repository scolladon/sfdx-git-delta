'use strict'
import { expect, describe, it } from '@jest/globals'
import {
  getDefinition,
  getInFileAttributes,
  getLatestSupportedVersion,
  getSharedFolderMetadata,
  isVersionSupported,
} from '../../../../src/metadata/metadataManager'
import { Metadata } from '../../../../src/types/metadata'
import { MetadataRepositoryImpl } from '../../../../src/metadata/MetadataRepositoryImpl'

describe(`test if metadata`, () => {
  it('provide latest when apiVersion does not exist', async () => {
    const metadata = await getDefinition(0)
    const latestVersionSupported = await getLatestSupportedVersion()
    const latestMetadataDef = await getDefinition(latestVersionSupported)

    expect(metadata).toBeDefined()
    expect(metadata).toEqual(latestMetadataDef)
    expect(latestMetadataDef.get('classes')).toBeDefined()
    expect(latestMetadataDef.get('do not exist')).toBeUndefined()
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
    const latestVersion = await getLatestSupportedVersion()
    expect(latestVersion).toBeDefined()
    expect(latestVersion).toEqual(expect.any(Number))
  })

  it('latest supported version is the second last version', async () => {
    // Arrange
    let i = 45

    // Act(s)
    while (await isVersionSupported(++i));
    // Here latest version should not be supported because it is equal to last version + 1

    // Assert
    const defaultLatestSupportedVersion = await getLatestSupportedVersion()
    // defaultLatestSupportedVersion should be equal to i + 1 (latest) + 1 (iteration)
    expect(i).toBe(defaultLatestSupportedVersion + 2)
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
    const metadata = new MetadataRepositoryImpl([
      {
        directoryName: 'waveTemplates',
        inFolder: true,
        metaFile: false,
        xmlName: 'WaveTemplateBundle',
      },
      {
        directoryName: 'workflows.alerts',
        inFolder: false,
        metaFile: false,
        xmlName: 'WorkflowAlert',
        xmlTag: 'alerts',
        key: 'fullName',
      },
      {
        directoryName: 'excluded',
        inFolder: false,
        metaFile: false,
        xmlName: 'Excluded',
        xmlTag: 'excluded',
        key: 'other',
        excluded: true,
      },
    ])

    // Act
    const inFileAttributes = getInFileAttributes(metadata)

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
    const otherInFileAttributes = getInFileAttributes(metadata)

    // Assert
    expect(otherInFileAttributes).toBe(inFileAttributes)
  })

  it('getSharedFolderMetadata', async () => {
    // Arrange
    const metadata = new MetadataRepositoryImpl([
      {
        directoryName: 'waveTemplates',
        inFolder: true,
        metaFile: false,
        xmlName: 'WaveTemplateBundle',
      } as Metadata,
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
