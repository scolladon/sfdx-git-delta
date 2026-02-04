'use strict'
import { describe, expect, it } from '@jest/globals'
import { MetadataDefinitionMerger } from '../../../../src/metadata/metadataDefinitionMerger'
import type { Metadata } from '../../../../src/types/metadata'

describe('MetadataDefinitionMerger', () => {
  const baseMetadata: Metadata[] = [
    {
      directoryName: 'classes',
      inFolder: false,
      metaFile: true,
      suffix: 'cls',
      xmlName: 'ApexClass',
    },
    {
      directoryName: 'triggers',
      inFolder: false,
      metaFile: true,
      suffix: 'trigger',
      xmlName: 'ApexTrigger',
    },
  ]

  describe('merge', () => {
    it('Given additional metadata with new type, When merging, Then result includes all types', () => {
      // Arrange
      const merger = new MetadataDefinitionMerger(baseMetadata)
      const additional: Metadata[] = [
        {
          directoryName: 'customDir',
          inFolder: false,
          metaFile: false,
          suffix: 'custom',
          xmlName: 'CustomType',
        },
      ]

      // Act
      const result = merger.merge(additional)

      // Assert
      expect(result).toHaveLength(3)
      expect(result.find(m => m.xmlName === 'CustomType')).toBeDefined()
    })

    it('Given base metadata without xmlName, When merging, Then it is ignored', () => {
      // Arrange
      const baseMetadataWithInvalidEntry = [
        { ...baseMetadata[0], xmlName: undefined },
      ] as unknown as Metadata[]
      const additionalMetadata = [] as Metadata[]
      const merger = new MetadataDefinitionMerger(baseMetadataWithInvalidEntry)

      // Act
      const merged = merger.merge(additionalMetadata)

      // Assert
      expect(merged).toHaveLength(0)
    })

    it('Given additional metadata with same xmlName as base, When merging, Then base properties override additional', () => {
      // Arrange
      const merger = new MetadataDefinitionMerger(baseMetadata)
      const additional: Metadata[] = [
        {
          directoryName: 'otherDir',
          inFolder: true,
          metaFile: false,
          suffix: 'other',
          xmlName: 'ApexClass',
        },
      ]

      // Act
      const result = merger.merge(additional)

      // Assert
      expect(result).toHaveLength(2)
      const apexClass = result.find(m => m.xmlName === 'ApexClass')
      expect(apexClass?.directoryName).toBe('classes')
    })

    it('Given additional metadata without xmlName, When merging, Then it is ignored', () => {
      // Arrange
      const merger = new MetadataDefinitionMerger(baseMetadata)
      const additional: Metadata[] = [
        {
          directoryName: 'noName',
          inFolder: false,
          metaFile: false,
        } as Metadata,
      ]

      // Act
      const result = merger.merge(additional)

      // Assert
      expect(result).toHaveLength(2)
    })

    it('Given chained merges, When second merge has duplicate xmlName, Then earlier definition takes priority', () => {
      // Arrange - first merge
      const merger1 = new MetadataDefinitionMerger(baseMetadata)
      const first: Metadata[] = [
        {
          directoryName: 'first',
          inFolder: false,
          metaFile: false,
          xmlName: 'FirstType',
        },
      ]
      const afterFirst = merger1.merge(first)

      // Arrange - second merge with duplicate
      const merger2 = new MetadataDefinitionMerger(afterFirst)
      const second: Metadata[] = [
        {
          directoryName: 'second',
          inFolder: false,
          metaFile: false,
          xmlName: 'SecondType',
        },
        {
          directoryName: 'duplicate',
          inFolder: false,
          metaFile: false,
          xmlName: 'FirstType',
        },
      ]

      // Act
      const afterSecond = merger2.merge(second)

      // Assert
      expect(afterSecond).toHaveLength(4)
      const firstType = afterSecond.find(m => m.xmlName === 'FirstType')
      expect(firstType?.directoryName).toBe('first')
    })
  })
})
