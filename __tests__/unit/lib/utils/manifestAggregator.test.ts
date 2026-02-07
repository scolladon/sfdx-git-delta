'use strict'
import { describe, expect, it } from '@jest/globals'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import { aggregateManifests } from '../../../../src/utils/manifestAggregator'

describe('aggregateManifests', () => {
  describe('Given an empty result', () => {
    it('When called, Then returns empty manifests', () => {
      // Arrange
      const result: HandlerResult = {
        manifests: [],
        copies: [],
        warnings: [],
      }

      // Act
      const manifests = aggregateManifests(result)

      // Assert
      expect(manifests.package.size).toBe(0)
      expect(manifests.destructiveChanges.size).toBe(0)
    })
  })

  describe('Given package manifest elements', () => {
    it('When called, Then populates package map', () => {
      // Arrange
      const result: HandlerResult = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'MyClass',
          },
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'OtherClass',
          },
        ],
        copies: [],
        warnings: [],
      }

      // Act
      const manifests = aggregateManifests(result)

      // Assert
      expect(manifests.package.get('ApexClass')).toEqual(
        new Set(['MyClass', 'OtherClass'])
      )
      expect(manifests.destructiveChanges.size).toBe(0)
    })
  })

  describe('Given destructive changes manifest elements', () => {
    it('When called, Then populates destructiveChanges map', () => {
      // Arrange
      const result: HandlerResult = {
        manifests: [
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'ApexClass',
            member: 'DeletedClass',
          },
        ],
        copies: [],
        warnings: [],
      }

      // Act
      const manifests = aggregateManifests(result)

      // Assert
      expect(manifests.package.size).toBe(0)
      expect(manifests.destructiveChanges.get('ApexClass')).toEqual(
        new Set(['DeletedClass'])
      )
    })
  })

  describe('Given mixed manifest elements', () => {
    it('When called, Then populates both maps correctly', () => {
      // Arrange
      const result: HandlerResult = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'NewClass',
          },
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'ApexTrigger',
            member: 'OldTrigger',
          },
          {
            target: ManifestTarget.Package,
            type: 'CustomObject',
            member: 'Account',
          },
        ],
        copies: [],
        warnings: [],
      }

      // Act
      const manifests = aggregateManifests(result)

      // Assert
      expect(manifests.package.get('ApexClass')).toEqual(new Set(['NewClass']))
      expect(manifests.package.get('CustomObject')).toEqual(
        new Set(['Account'])
      )
      expect(manifests.destructiveChanges.get('ApexTrigger')).toEqual(
        new Set(['OldTrigger'])
      )
    })
  })

  describe('Given duplicate members', () => {
    it('When called, Then deduplicates via Set', () => {
      // Arrange
      const result: HandlerResult = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'MyClass',
          },
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'MyClass',
          },
        ],
        copies: [],
        warnings: [],
      }

      // Act
      const manifests = aggregateManifests(result)

      // Assert
      expect(manifests.package.get('ApexClass')?.size).toBe(1)
    })
  })
})
