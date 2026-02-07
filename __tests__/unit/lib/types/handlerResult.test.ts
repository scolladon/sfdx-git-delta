'use strict'
import { describe, expect, it } from '@jest/globals'

import {
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
  mergeResults,
} from '../../../../src/types/handlerResult'

describe('emptyResult', () => {
  describe('Given no arguments', () => {
    it('When called, Then returns result with empty arrays', () => {
      // Arrange & Act
      const result = emptyResult()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('When called twice, Then returns independent instances', () => {
      // Arrange
      const result1 = emptyResult()
      const result2 = emptyResult()

      // Act
      result1.manifests.push({
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'MyClass',
      })

      // Assert
      expect(result2.manifests).toEqual([])
    })
  })
})

describe('mergeResults', () => {
  describe('Given no results', () => {
    it('When called, Then returns empty result', () => {
      // Arrange & Act
      const result = mergeResults()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given a single result', () => {
    it('When called, Then returns the same elements', () => {
      // Arrange
      const input = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'MyClass',
          },
        ],
        copies: [
          {
            kind: CopyOperationKind.GitCopy as const,
            path: 'classes/MyClass.cls',
            revision: 'abc123',
          },
        ],
        warnings: [new Error('some warning')],
      }

      // Act
      const result = mergeResults(input)

      // Assert
      expect(result.manifests).toEqual(input.manifests)
      expect(result.copies).toEqual(input.copies)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toBe('some warning')
    })
  })

  describe('Given multiple results', () => {
    it('When called, Then concatenates all arrays', () => {
      // Arrange
      const result1 = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'ClassA',
          },
        ],
        copies: [
          {
            kind: CopyOperationKind.GitCopy as const,
            path: 'classes/ClassA.cls',
            revision: 'abc',
          },
        ],
        warnings: [],
      }
      const result2 = {
        manifests: [
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'ApexClass',
            member: 'ClassB',
          },
        ],
        copies: [
          {
            kind: CopyOperationKind.ComputedContent as const,
            path: 'labels/CustomLabels.labels',
            content: '<xml>content</xml>',
          },
        ],
        warnings: [new Error('warning')],
      }

      // Act
      const result = mergeResults(result1, result2)

      // Assert
      expect(result.manifests).toHaveLength(2)
      expect(result.manifests[0].member).toBe('ClassA')
      expect(result.manifests[1].member).toBe('ClassB')
      expect(result.copies).toHaveLength(2)
      expect(result.copies[0].kind).toBe(CopyOperationKind.GitCopy)
      expect(result.copies[1].kind).toBe(CopyOperationKind.ComputedContent)
      expect(result.warnings).toHaveLength(1)
    })
  })
})
