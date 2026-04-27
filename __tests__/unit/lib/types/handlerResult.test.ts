'use strict'
import { describe, expect, it } from 'vitest'

import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
  mergeResults,
} from '../../../../src/types/handlerResult'
import ChangeSet from '../../../../src/utils/changeSet'

describe('emptyResult', () => {
  describe('Given no arguments', () => {
    it('When called, Then returns result with empty arrays', () => {
      // Arrange & Act
      const result = emptyResult()

      // Assert
      expect(result.changes.toElements()).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('When called twice, Then returns independent instances', () => {
      // Arrange
      const result1 = emptyResult()
      const result2 = emptyResult()

      // Act
      result1.changes.addElement({
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'MyClass',
        changeKind: ChangeKind.Add,
      })

      // Assert
      expect(result2.changes.toElements()).toEqual([])
    })
  })
})

describe('mergeResults', () => {
  describe('Given no results', () => {
    it('When called, Then returns empty result', () => {
      // Arrange & Act
      const result = mergeResults()

      // Assert
      expect(result.changes.toElements()).toEqual([])
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
        changes: ChangeSet.from(elements),
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
      expect(result.changes.toElements()).toEqual(elements)
      expect(result.copies).toEqual(input.copies)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toBe('some warning')
    })
  })

  describe('Given multiple results', () => {
    it('When called, Then concatenates all arrays', () => {
      // Arrange
      const result1 = {
        changes: ChangeSet.from([
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'ClassA',
            changeKind: ChangeKind.Add,
          },
        ]),
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
        changes: ChangeSet.from([
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'ApexClass',
            member: 'ClassB',
            changeKind: ChangeKind.Delete,
          },
        ]),
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
      expect(result.changes.toElements()).toHaveLength(2)
      expect(result.changes.toElements()[0].member).toBe('ClassA')
      expect(result.changes.toElements()[1].member).toBe('ClassB')
      expect(result.copies).toHaveLength(2)
      expect(result.copies[0].kind).toBe(CopyOperationKind.GitCopy)
      expect(result.copies[1].kind).toBe(CopyOperationKind.StreamedContent)
      expect(result.warnings).toHaveLength(1)
    })
  })
})
