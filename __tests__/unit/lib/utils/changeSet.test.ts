'use strict'
import { describe, expect, it } from 'vitest'

import type { ManifestElement } from '../../../../src/types/handlerResult'
import { ChangeKind, ManifestTarget } from '../../../../src/types/handlerResult'
import ChangeSet from '../../../../src/utils/changeSet'

describe('ChangeSet', () => {
  describe('Given a fresh ChangeSet', () => {
    it('When reading any view, Then every bucket is empty', () => {
      // Arrange
      const sut = new ChangeSet()

      // Act & Assert
      expect(sut.forPackageManifest().size).toBe(0)
      expect(sut.forDestructiveManifest().size).toBe(0)
      const byKind = sut.byChangeKind()
      expect(byKind[ChangeKind.Add].size).toBe(0)
      expect(byKind[ChangeKind.Modify].size).toBe(0)
      expect(byKind[ChangeKind.Delete].size).toBe(0)
      expect(byKind[ChangeKind.Rename].size).toBe(0)
    })
  })

  describe('Given add and modify entries', () => {
    it('When reading forPackageManifest, Then it unions add ∪ modify per type', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.add(ChangeKind.Add, 'ApexClass', 'New')
      sut.add(ChangeKind.Modify, 'ApexClass', 'Edited')
      sut.add(ChangeKind.Modify, 'CustomObject', 'Account')

      // Act
      const result = sut.forPackageManifest()

      // Assert
      expect(result.get('ApexClass')).toEqual(new Set(['New', 'Edited']))
      expect(result.get('CustomObject')).toEqual(new Set(['Account']))
    })
  })

  describe('Given only delete entries', () => {
    it('When reading forDestructiveManifest, Then it returns all deletions', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.add(ChangeKind.Delete, 'ApexTrigger', 'Old')

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('ApexTrigger')).toEqual(new Set(['Old']))
    })
  })

  describe('Given a delete cancelled by an add', () => {
    it('When reading forDestructiveManifest, Then the cancelled entry is dropped but the add remains', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.add(ChangeKind.Add, 'ApexClass', 'ReAdded')
      sut.add(ChangeKind.Delete, 'ApexClass', 'ReAdded')
      sut.add(ChangeKind.Delete, 'ApexClass', 'Truly')

      // Act
      const destructive = sut.forDestructiveManifest()
      const pkg = sut.forPackageManifest()

      // Assert
      expect(destructive.get('ApexClass')).toEqual(new Set(['Truly']))
      expect(pkg.get('ApexClass')).toEqual(new Set(['ReAdded']))
    })
  })

  describe('Given every delete of a type is cancelled', () => {
    it('When reading forDestructiveManifest, Then the type is omitted entirely', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.add(ChangeKind.Modify, 'CustomLabels', 'My.Label')
      sut.add(ChangeKind.Delete, 'CustomLabels', 'My.Label')

      // Act
      const destructive = sut.forDestructiveManifest()

      // Assert
      expect(destructive.has('CustomLabels')).toBe(false)
    })
  })

  describe('Given mixed entries', () => {
    it('When reading byChangeKind, Then the delete bucket is already coalesced', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.add(ChangeKind.Add, 'ApexClass', 'Foo')
      sut.add(ChangeKind.Delete, 'ApexClass', 'Foo')
      sut.add(ChangeKind.Delete, 'ApexClass', 'Bar')

      // Act
      const view = sut.byChangeKind()

      // Assert
      expect(view[ChangeKind.Add].get('ApexClass')).toEqual(new Set(['Foo']))
      expect(view[ChangeKind.Delete].get('ApexClass')).toEqual(new Set(['Bar']))
    })
  })

  describe('Given the same member added twice under the same kind', () => {
    it('When reading the view, Then deduplication via Set is preserved', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.add(ChangeKind.Add, 'ApexClass', 'Foo')
      sut.add(ChangeKind.Add, 'ApexClass', 'Foo')

      // Act & Assert
      expect(sut.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['Foo'])
      )
    })
  })

  describe('ChangeSet.from factory', () => {
    it('Given ManifestElements, When constructing via from, Then each element lands in its declared kind bucket', () => {
      // Arrange
      const elements: ManifestElement[] = [
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'A',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'B',
          changeKind: ChangeKind.Modify,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ApexTrigger',
          member: 'C',
          changeKind: ChangeKind.Delete,
        },
      ]

      // Act
      const sut = ChangeSet.from(elements)

      // Assert
      expect(sut.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['A', 'B'])
      )
      expect(sut.forDestructiveManifest().get('ApexTrigger')).toEqual(
        new Set(['C'])
      )
    })
  })

  describe('recordRename', () => {
    it('Given matching synthetic add/delete, When recording a rename, Then the package view keeps to-member, destructive view keeps from-member, and by-kind add/delete drop them', () => {
      // Arrange — the handler pipeline first sees the split A/D lines, then
      // main.ts resolves the rename pair and calls recordRename.
      const sut = new ChangeSet()
      sut.add(ChangeKind.Add, 'ApexClass', 'NewName')
      sut.add(ChangeKind.Delete, 'ApexClass', 'OldName')
      sut.recordRename('ApexClass', 'OldName', 'NewName')

      // Act
      const pkg = sut.forPackageManifest()
      const destructive = sut.forDestructiveManifest()
      const byKind = sut.byChangeKind()

      // Assert
      expect(pkg.get('ApexClass')).toEqual(new Set(['NewName']))
      expect(destructive.get('ApexClass')).toEqual(new Set(['OldName']))
      expect(byKind[ChangeKind.Add].has('ApexClass')).toBe(false)
      expect(byKind[ChangeKind.Delete].has('ApexClass')).toBe(false)
      const renameMap = byKind[ChangeKind.Rename].get('ApexClass')!
      expect([...renameMap.values()]).toEqual([
        { from: 'OldName', to: 'NewName' },
      ])
    })

    it('Given a no-op rename where from equals to, When recording, Then it is ignored', () => {
      // Arrange
      const sut = new ChangeSet()

      // Act
      sut.recordRename('ApexClass', 'Same', 'Same')

      // Assert
      expect(sut.byChangeKind()[ChangeKind.Rename].size).toBe(0)
    })

    it('Given the same rename pair recorded twice (e.g. bundle rename re-emitted per file), When recording, Then it collapses to a single entry', () => {
      // Arrange
      const sut = new ChangeSet()
      sut.recordRename('LightningComponentBundle', 'old', 'new')
      sut.recordRename('LightningComponentBundle', 'old', 'new')

      // Act
      const bucket = sut
        .byChangeKind()
        [ChangeKind.Rename].get('LightningComponentBundle')!

      // Assert
      expect(bucket.size).toBe(1)
      expect([...bucket.values()]).toEqual([{ from: 'old', to: 'new' }])
    })
  })
})
