import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { MetadataRepositoryImpl } from '../../../../src/metadata/MetadataRepositoryImpl'
import {
  getDefinition,
  getInFileAttributes,
  getLatestSupportedVersion,
  getSharedFolderMetadata,
  isPackable,
  resetMetadataCache,
} from '../../../../src/metadata/metadataManager'
import { SDRMetadataAdapter } from '../../../../src/metadata/sdrMetadataAdapter'

import type { Metadata } from '../../../../src/types/metadata'
import * as fsUtils from '../../../../src/utils/fsUtils'

describe(`test if metadata`, () => {
  beforeEach(() => {
    resetMetadataCache()
  })
  it('provide latest when apiVersion is undefined', async () => {
    const metadata = await getDefinition({ apiVersion: undefined })
    const latestVersionSupported = await getLatestSupportedVersion()
    const latestMetadataDef = await getDefinition({
      apiVersion: latestVersionSupported,
    })

    expect(metadata).toBeDefined()
    expect(metadata).toEqual(latestMetadataDef)
    expect(latestMetadataDef.get('classes')).toBeDefined()
    expect(latestMetadataDef.get('do not exist')).toBeUndefined()
  })

  it('provide latest when apiVersion does not exist', async () => {
    const metadata = await getDefinition({ apiVersion: 0 })
    const latestVersionSupported = await getLatestSupportedVersion()
    const latestMetadataDef = await getDefinition({
      apiVersion: latestVersionSupported,
    })

    expect(metadata).toBeDefined()
    expect(metadata).toEqual(latestMetadataDef)
    expect(latestMetadataDef.get('classes')).toBeDefined()
    expect(latestMetadataDef.get('do not exist')).toBeUndefined()
  })

  it('has classes', async () => {
    const metadata = await getDefinition({ apiVersion: 58 })
    expect(metadata.get('classes')).toBeDefined()
  })

  it('do not have do not exist', async () => {
    let metadata = await getDefinition({ apiVersion: 48 })
    metadata = await getDefinition({ apiVersion: 46 })
    expect(metadata).toBeDefined()
    expect(metadata.get('do not exist')).toBeFalsy()
  })

  it('getLatestSupportedVersion', async () => {
    jest
      .spyOn(SDRMetadataAdapter, 'getLatestApiVersion')
      .mockResolvedValue('58')
    const latestVersion = await getLatestSupportedVersion()

    expect(latestVersion).toBeDefined()
    expect(latestVersion).toEqual(58)
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
      {
        directoryName: 'globalValueSetTranslations',
        inFolder: false,
        metaFile: false,
        xmlName: 'GlobalValueSetTranslation',
        xmlTag: 'globalValueSetTranslation',
        key: 'fullName',
      },
      {
        directoryName: 'none',
        inFolder: false,
        metaFile: false,
        xmlName: 'ValueTranslation',
        parentXmlName: 'GlobalValueSetTranslation',
        xmlTag: 'valueTranslation',
      },
      {
        directoryName: 'noXmlName',
        inFolder: false,
        metaFile: false,
        // xmlName undefined
        xmlTag: 'noXmlName',
        key: 'fullName',
      } as unknown as Metadata,
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
    expect(inFileAttributes.has('globalValueSetTranslation')).toBe(true)
    expect(inFileAttributes.get('globalValueSetTranslation')).toEqual({
      xmlName: 'GlobalValueSetTranslation',
      key: 'fullName',
      excluded: true,
    })
    expect(inFileAttributes.has('valueTranslation')).toBe(true)
    expect(inFileAttributes.get('valueTranslation')).toEqual({
      xmlName: 'ValueTranslation',
      excluded: true,
    })
    expect(inFileAttributes.has('noXmlName')).toBe(true)
    expect(inFileAttributes.get('noXmlName')).toEqual({
      xmlName: undefined,
      key: 'fullName',
      excluded: false,
    })

    // Act
    const otherInFileAttributes = getInFileAttributes(metadata)

    // Assert
    expect(otherInFileAttributes).toBe(inFileAttributes)
  })

  it('isPackable', () => {
    // Arrange - populate the cache with test metadata
    const metadata = new MetadataRepositoryImpl([
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
    getInFileAttributes(metadata)

    // Act & Assert
    expect(isPackable('WorkflowAlert')).toBe(true)
    expect(isPackable('Excluded')).toBe(false)
    expect(isPackable('Unknown')).toBe(true)
  })

  it('getDefinition with additional registry', async () => {
    const additionalRegistryContent = `[
      {
        "xmlName": "CustomThing",
        "suffix": "thing",
        "directoryName": "things",
        "inFolder": false,
        "metaFile": false
      }
    ]`
    const readFileSpy = jest
      .spyOn(fsUtils, 'readFile')
      .mockResolvedValue(additionalRegistryContent)

    const metadata = await getDefinition({
      apiVersion: undefined,
      additionalMetadataRegistryPath: 'path/to/registry.json',
    })
    expect(metadata.get('CustomThing')).toBeDefined()
    expect(readFileSpy).toHaveBeenCalledWith('path/to/registry.json')
    readFileSpy.mockRestore()
  })

  it('getDefinition with invalid additional registry', async () => {
    const additionalRegistryContent = 'invalid json'
    const readFileSpy = jest
      .spyOn(fsUtils, 'readFile')
      .mockResolvedValue(additionalRegistryContent)

    await expect(
      getDefinition({
        apiVersion: undefined,
        additionalMetadataRegistryPath: 'path/to/registry.json',
      })
    ).rejects.toThrow(
      "Unable to parse the additional metadata registry file 'path/to/registry.json'. Caused by: SyntaxError: Unexpected token 'i', \"invalid json\" is not valid JSON"
    )
    readFileSpy.mockRestore()
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
