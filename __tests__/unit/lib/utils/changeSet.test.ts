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
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'New',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'Edited',
          changeKind: ChangeKind.Modify,
        },
        {
          target: ManifestTarget.Package,
          type: 'CustomObject',
          member: 'Account',
          changeKind: ChangeKind.Modify,
        },
      ])

      // Act
      const result = sut.forPackageManifest()

      // Assert
      expect(result.get('ApexClass')).toEqual(new Set(['New', 'Edited']))
      expect(result.get('CustomObject')).toEqual(new Set(['Account']))
    })
  })

  describe('Given a delete cancelled by an add', () => {
    it('When reading forDestructiveManifest, Then the cancelled entry is dropped but the add remains', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'ReAdded',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ApexClass',
          member: 'ReAdded',
          changeKind: ChangeKind.Delete,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ApexClass',
          member: 'Truly',
          changeKind: ChangeKind.Delete,
        },
      ])

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
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'CustomLabels',
          member: 'My.Label',
          changeKind: ChangeKind.Modify,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'CustomLabels',
          member: 'My.Label',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const destructive = sut.forDestructiveManifest()

      // Assert
      expect(destructive.has('CustomLabels')).toBe(false)
    })
  })

  describe('Given mixed entries', () => {
    it('When reading byChangeKind, Then the delete bucket is already coalesced', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'Foo',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ApexClass',
          member: 'Foo',
          changeKind: ChangeKind.Delete,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ApexClass',
          member: 'Bar',
          changeKind: ChangeKind.Delete,
        },
      ])

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
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'Foo',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'Foo',
          changeKind: ChangeKind.Add,
        },
      ])

      // Act & Assert
      expect(sut.forPackageManifest().get('ApexClass')).toEqual(
        new Set(['Foo'])
      )
    })
  })

  describe('Given a non-conventional (target, changeKind) pair (e.g. InFileHandler stamping a deleted container as Package+Delete to preserve surviving sub-elements)', () => {
    it('When reading the xml and JSON views, Then the xml manifests route on target (package) while byChangeKind routes on changeKind (delete)', () => {
      // Arrange — ManifestElement carries both axes explicitly so callers
      // that diverge from the conventional Delete → DestructiveChanges
      // pairing can stamp Package+Delete. This is the case InFileHandler
      // hits when a CustomLabels container file is deleted but some
      // children survive: the deployment manifest must keep it in
      // package.xml while reviewers still see a delete in the JSON.
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'CustomLabels',
          member: 'CustomLabels',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const pkg = sut.forPackageManifest()
      const destructive = sut.forDestructiveManifest()
      const byKind = sut.byChangeKind()

      // Assert
      expect(pkg.get('CustomLabels')).toEqual(new Set(['CustomLabels']))
      expect(destructive.has('CustomLabels')).toBe(false)
      expect(byKind[ChangeKind.Delete].get('CustomLabels')).toEqual(
        new Set(['CustomLabels'])
      )
      expect(byKind[ChangeKind.Add].has('CustomLabels')).toBe(false)
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

  describe('Given a type that appears in both byTarget[Package] and as a rename target', () => {
    it('When reading forPackageManifest, Then members from both sources merge into the same type bucket', () => {
      // Arrange — exercises the _unionByType "type already exists, merge
      // members into the existing Set" branch. Without the merge, the
      // rename-target entry would overwrite the direct Package add.
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'DirectAdd',
          changeKind: ChangeKind.Add,
        },
      ])
      sut.recordRename('ApexClass', 'OldName', 'RenamedTo')

      // Act
      const pkg = sut.forPackageManifest()

      // Assert
      expect(pkg.get('ApexClass')).toEqual(new Set(['DirectAdd', 'RenamedTo']))
    })
  })

  describe('recordRename', () => {
    it('Given matching synthetic add/delete, When recording a rename, Then the package view keeps to-member, destructive view keeps from-member, and by-kind add/delete drop them', () => {
      // Arrange — the handler pipeline first sees the split A/D lines, then
      // main.ts resolves the rename pair and calls recordRename.
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'NewName',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ApexClass',
          member: 'OldName',
          changeKind: ChangeKind.Delete,
        },
      ])
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
      // Arrange — the dedup key is `${from}\0${to}`, so only *identical*
      // pairs collapse. Collisions where `from` matches but `to` differs
      // (or vice versa) are not reachable in practice: RenameResolver is
      // fed one git-detected rename per component, and LWC bundle files
      // only synthesise duplicate identical pairs. Omitted from coverage.
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
