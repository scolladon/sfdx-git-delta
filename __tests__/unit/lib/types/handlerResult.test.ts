'use strict'
import { describe, expect, it } from 'vitest'

import {
  ChangeKind,
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
      expect(result.elements).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('When called twice, Then returns independent instances', () => {
      // Arrange & Act
      const result1 = emptyResult()
      const result2 = emptyResult()

      // Assert
      expect(result1).not.toBe(result2)
      expect(result1.elements).not.toBe(result2.elements)
    })
  })
})

describe('mergeResults', () => {
  describe('Given no results', () => {
    it('When called, Then returns empty result', () => {
      // Arrange & Act
      const result = mergeResults()

      // Assert
      expect(result.elements).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given a single result', () => {
    it('When called, Then returns the same elements', () => {
      // Arrange
      const elements = [
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'MyClass',
          changeKind: ChangeKind.Add as ChangeKind.Add,
        },
      ]
      const input = {
        elements,
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
      expect(result.elements).toEqual(elements)
      expect(result.copies).toEqual(input.copies)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toBe('some warning')
    })
  })

  describe('Given multiple results', () => {
    it('When called, Then concatenates all arrays', () => {
      // Arrange
      const result1 = {
        elements: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'ClassA',
            changeKind: ChangeKind.Add as ChangeKind.Add,
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
        elements: [
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'ApexClass',
            member: 'ClassB',
            changeKind: ChangeKind.Delete as ChangeKind.Delete,
          },
        ],
        copies: [
          {
            kind: CopyOperationKind.StreamedContent as const,
            path: 'labels/CustomLabels.labels',
            writer: async () => undefined,
          },
        ],
        warnings: [new Error('warning')],
      }

      // Act
      const result = mergeResults(result1, result2)

      // Assert
      expect(result.elements).toHaveLength(2)
      expect(result.elements[0].member).toBe('ClassA')
      expect(result.elements[1].member).toBe('ClassB')
      expect(result.copies).toHaveLength(2)
      expect(result.copies[0].kind).toBe(CopyOperationKind.GitCopy)
      expect(result.copies[1].kind).toBe(CopyOperationKind.StreamedContent)
      expect(result.warnings).toHaveLength(1)
    })

    it('Given the same element twice across two results, When called, Then the merged elements keep both — concat, not set-union', () => {
      // Arrange — mergeResults is pure concatenation over the flat axes;
      // de-duplication is the fold's job (ChangeSet.from), not this factory's.
      const element = {
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'Dup',
        changeKind: ChangeKind.Add as ChangeKind.Add,
      }
      const result1 = { elements: [element], copies: [], warnings: [] }
      const result2 = { elements: [element], copies: [], warnings: [] }

      // Act
      const result = mergeResults(result1, result2)

      // Assert
      expect(result.elements).toEqual([element, element])
    })
  })
})
