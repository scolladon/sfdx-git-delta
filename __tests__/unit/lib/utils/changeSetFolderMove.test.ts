'use strict'
import { describe, expect, it } from 'vitest'

import { ChangeKind, ManifestTarget } from '../../../../src/types/handlerResult'
import ChangeSet from '../../../../src/utils/changeSet'

describe('ChangeSet', () => {
  describe('Given a Report whose folder moved', () => {
    it('When the destructive manifest is read, Then the former path is dropped', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_A',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_A',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.has('Report')).toBe(false)
    })

    it('When the move arrives as a rename pair, Then the former path is still dropped', () => {
      // Arrange — no Package element on purpose: the rename target is the only
      // thing that can vouch here, so this pins the rename arm of the
      // suppression reference rather than riding on a handler-emitted addition.
      const sut = ChangeSet.from(
        [
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'Report',
            member: 'OldFolder/My_Report_A',
            changeKind: ChangeKind.Delete,
          },
        ],
        [
          {
            type: 'Report',
            from: 'OldFolder/My_Report_A',
            to: 'NewFolder/My_Report_A',
          },
        ]
      )

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.has('Report')).toBe(false)
    })

    it('When the move only re-cases the DeveloperName, Then the former path is dropped', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/MY_REPORT',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.has('Report')).toBe(false)
    })

    it('When the report sits directly under the type directory, Then the whole member is its DeveloperName', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'My_Report',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.has('Report')).toBe(false)
    })

    it('When the move also changes the DeveloperName, Then the former path survives', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_C_Renamed',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_C',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('Report')).toEqual(new Set(['OldFolder/My_Report_C']))
    })

    it('When one moved report matches and another does not, Then only the match is dropped', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_A',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_C_Renamed',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_A',
          changeKind: ChangeKind.Delete,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_C',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('Report')).toEqual(new Set(['OldFolder/My_Report_C']))
    })
  })

  describe('Given a Report deleted outright with no surviving Report', () => {
    it('When the destructive manifest is read, Then the deletion survives', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_A',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('Report')).toEqual(new Set(['OldFolder/My_Report_A']))
    })
  })

  describe('Given a Document whose folder moved', () => {
    it('When the destructive manifest is read, Then the former path still emits', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Document',
          member: 'NewDocFolder/My_Doc',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Document',
          member: 'OldDocFolder/My_Doc',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('Document')).toEqual(new Set(['OldDocFolder/My_Doc']))
    })
  })

  describe('Given two reports sharing a DeveloperName under different folders', () => {
    it('When one is deleted and the other added, Then the deletion is still dropped', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'Archive/Quarterly',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'Sales/Quarterly',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.has('Report')).toBe(false)
    })
  })

  describe('Given a report folder deleted while a same-named report survives elsewhere', () => {
    it('When the destructive manifest is read, Then the folder deletion is kept', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'ReportFolder',
          member: 'Foo',
          changeKind: ChangeKind.Delete,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'Foo/Foo',
          changeKind: ChangeKind.Delete,
        },
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'Bar/Foo',
          changeKind: ChangeKind.Add,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('ReportFolder')).toEqual(new Set(['Foo']))
      expect(result.has('Report')).toBe(false)
    })
  })

  describe('Given only a Report addition and no Report deletion', () => {
    it('When the destructive manifest is read, Then nothing is suppressed', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_A',
          changeKind: ChangeKind.Add,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.size).toBe(0)
    })
  })

  describe('Given a Dashboard whose folder moved', () => {
    it('When the destructive manifest is read, Then the former path is dropped', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Dashboard',
          member: 'NewDash/My_Dash',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Dashboard',
          member: 'OldDash/My_Dash',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.has('Dashboard')).toBe(false)
    })
  })

  describe('Given a Report folder move seen through the change-kind view', () => {
    it('When byChangeKind is read, Then the delete bucket drops the moved member', () => {
      // Arrange
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_A',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_A',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.byChangeKind()[ChangeKind.Delete]

      // Assert
      expect(result.has('Report')).toBe(false)
    })
  })

  describe('Given a Report deleted outright beside an unrelated Report rename seen through the destructive manifest', () => {
    it('When the destructive manifest is read, Then both deletions survive', () => {
      // Arrange — the rename source must not vouch for anything: it is not a
      // surviving component, and its DeveloperName is by definition the
      // DeveloperName of a member still being deleted.
      const sut = ChangeSet.from(
        [
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'Report',
            member: 'Old/Foo',
            changeKind: ChangeKind.Delete,
          },
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'Report',
            member: 'Other/Foo',
            changeKind: ChangeKind.Delete,
          },
        ],
        [{ type: 'Report', from: 'Other/Foo', to: 'Elsewhere/Bar' }]
      )

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('Report')).toEqual(new Set(['Old/Foo', 'Other/Foo']))
    })
  })

  describe('Given a Report already at the destination folder that is modified', () => {
    it('When the change-kind view is read, Then the moved member is still dropped', () => {
      // Arrange — the surviving side is a Modify, not an Add: a component that
      // was already there and was edited still explains the deletion away.
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'NewFolder/My_Report_A',
          changeKind: ChangeKind.Modify,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'OldFolder/My_Report_A',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.byChangeKind()

      // Assert
      expect(result[ChangeKind.Delete].has('Report')).toBe(false)
    })
  })

  describe('Given reports whose members carry no DeveloperName', () => {
    it('When the destructive manifest is read, Then one malformed member does not cancel another', () => {
      // Arrange — a file named only by its suffix leaves a trailing separator,
      // so the derived DeveloperName is empty on both sides.
      const sut = ChangeSet.from([
        {
          target: ManifestTarget.Package,
          type: 'Report',
          member: 'Sales/',
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'Report',
          member: 'Archive/',
          changeKind: ChangeKind.Delete,
        },
      ])

      // Act
      const result = sut.forDestructiveManifest()

      // Assert
      expect(result.get('Report')).toEqual(new Set(['Archive/']))
    })
  })

  describe('Given a Report deleted outright beside an unrelated Report rename', () => {
    it('When byChangeKind is read, Then the outright deletion is still reported', () => {
      // Arrange
      const sut = ChangeSet.from(
        [
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'Report',
            member: 'Old/Foo',
            changeKind: ChangeKind.Delete,
          },
          {
            target: ManifestTarget.Package,
            type: 'Report',
            member: 'Elsewhere/Bar',
            changeKind: ChangeKind.Add,
          },
          {
            target: ManifestTarget.DestructiveChanges,
            type: 'Report',
            member: 'Other/Foo',
            changeKind: ChangeKind.Delete,
          },
        ],
        [{ type: 'Report', from: 'Other/Foo', to: 'Elsewhere/Bar' }]
      )

      // Act
      const result = sut.byChangeKind()[ChangeKind.Delete]

      // Assert
      expect(result.get('Report')).toEqual(new Set(['Old/Foo']))
    })
  })
})
