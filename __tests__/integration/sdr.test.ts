'use strict'
import { describe, expect, it } from '@jest/globals'

import { SDRMetadataAdapter } from '../../src/metadata/sdrMetadataAdapter'
import type { Metadata } from '../../src/types/metadata'

describe('SDRMetadataAdapter', () => {
  describe('toInternalMetadata', () => {
    it('should return an array of metadata from SDR registry', () => {
      // Arrange
      // (No arrangement needed, static method)

      // Act
      const metadata = SDRMetadataAdapter.toInternalMetadata()

      // Assert
      expect(metadata).toBeDefined()
      expect(Array.isArray(metadata)).toBe(true)
      expect(metadata.length).toBeGreaterThan(0)
    })

    it('should include ApexClass metadata', () => {
      // Arrange
      // (No arrangement needed)

      // Act
      const metadata = SDRMetadataAdapter.toInternalMetadata()
      const apexClass = metadata.find(
        (m: Metadata) => m.xmlName === 'ApexClass'
      )

      // Assert
      expect(apexClass).toBeDefined()
      expect(apexClass?.directoryName).toBe('classes')
      expect(apexClass?.suffix).toBe('cls')
    })

    it('should include CustomObject metadata with children', () => {
      // Arrange
      // (No arrangement needed)

      // Act
      const metadata = SDRMetadataAdapter.toInternalMetadata()
      const customObject = metadata.find(
        (m: Metadata) => m.xmlName === 'CustomObject'
      )

      // Assert
      expect(customObject).toBeDefined()
      expect(customObject?.directoryName).toBe('objects')
      expect(customObject?.childXmlNames).toBeDefined()
      expect(customObject?.childXmlNames?.length).toBeGreaterThan(0)
    })

    it('should convert child types with parentXmlName', () => {
      // Arrange
      // (No arrangement needed)

      // Act
      const metadata = SDRMetadataAdapter.toInternalMetadata()
      const customField = metadata.find(
        (m: Metadata) => m.xmlName === 'CustomField'
      )

      // Assert
      expect(customField).toBeDefined()
      expect(customField?.parentXmlName).toBe('CustomObject')
    })

    it('should set inFolder correctly', () => {
      // Arrange
      // (No arrangement needed)

      // Act
      const metadata = SDRMetadataAdapter.toInternalMetadata()
      const report = metadata.find((m: Metadata) => m.xmlName === 'Report')

      // Assert
      expect(report).toBeDefined()
      expect(report?.inFolder).toBe(true)
    })

    it('should set metaFile correctly for bundle types', () => {
      // Arrange
      // (No arrangement needed)

      // Act
      const metadata = SDRMetadataAdapter.toInternalMetadata()
      const lwc = metadata.find(
        (m: Metadata) => m.xmlName === 'LightningComponentBundle'
      )

      // Assert
      expect(lwc).toBeDefined()
      expect(lwc?.metaFile).toBe(true)
    })
  })
})
