'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ContainedDecomposedHandler from '../../../../src/service/containedDecomposedHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const mockedReadDirs = vi.mocked(readDirs)

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  work = getWork()
  work.config.generateDelta = true
})

describe('ContainedDecomposedHandler', () => {
  describe('collect', () => {
    it('Given non-decomposed addition with generateDelta false, When collect, Then returns manifest with copies', async () => {
      // Arrange
      work.config.generateDelta = false
      const { changeType, element } = createElement(
        `A       force-app/main/permissionsets/Subject.permissionset-meta.xml`,
        globalMetadata.get('permissionsets')!,
        globalMetadata
      )
      const sut = new ContainedDecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'PermissionSet',
            member: 'Subject',
          }),
        ])
      )
      expect(result.copies).toHaveLength(0)
    })

    describe.each([
      'permissionsets',
      'other',
      'permissionsets/subFolder',
    ])('Given non-decomposed format in folder %s', folder => {
      it('When addition, Then returns Package manifest with file copy', async () => {
        // Arrange
        const line = `force-app/main/${folder}/Subject.permissionset-meta.xml`
        const { changeType, element } = createElement(
          `A       ${line}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'PermissionSet',
              member: 'Subject',
            }),
          ])
        )
        expect(result.copies.length).toBeGreaterThan(0)
      })

      it('When modification, Then returns Package manifest with file copy', async () => {
        // Arrange
        const line = `force-app/main/${folder}/Subject.permissionset-meta.xml`
        const { changeType, element } = createElement(
          `M       ${line}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'PermissionSet',
              member: 'Subject',
            }),
          ])
        )
        expect(result.copies.length).toBeGreaterThan(0)
      })

      it('When deletion, Then returns DestructiveChanges manifest without copies', async () => {
        // Arrange
        const line = `force-app/main/${folder}/Subject.permissionset-meta.xml`
        const { changeType, element } = createElement(
          `D       ${line}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.DestructiveChanges,
              type: 'PermissionSet',
              member: 'Subject',
            }),
          ])
        )
        expect(result.copies).toHaveLength(0)
      })
    })

    describe.each([
      'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
      'force-app/main/default/permissionsets/Admin/Admin.flowAccesses-meta.xml',
      'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Test__c.fieldPermission-meta.xml',
      'force-app/main/default/permissionsets/Admin/classAccesses/MyClass.classAccess-meta.xml',
      'force-app/main/default/permissionsets/marketing/Admin/objectSettings/Account.objectSettings-meta.xml',
      'force-app/main/default/permissionsets/marketing/Admin/Admin.flowAccesses-meta.xml',
      'force-app/main/default/permissionsets/marketing/Admin/fieldPermissions/Account.Test__c.fieldPermission-meta.xml',
      'force-app/main/default/permissionsets/marketing/Admin/classAccesses/MyClass.classAccess-meta.xml',
    ])('Given decomposed format for %s', decomposedLine => {
      it('When addition, Then returns Package manifest with holder folder copies', async () => {
        // Arrange
        const existingFiles = [
          'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
          'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
          'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
        ]
        mockedReadDirs.mockResolvedValue(existingFiles)

        const { changeType, element } = createElement(
          `A       ${decomposedLine}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'PermissionSet',
              member: 'Admin',
            }),
          ])
        )
        expect(result.copies.length).toBeGreaterThan(0)
      })

      it('When modification, Then returns Package manifest with holder folder copies', async () => {
        // Arrange
        const existingFiles = [
          'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
          'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
          'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
        ]
        mockedReadDirs.mockResolvedValue(existingFiles)

        const { changeType, element } = createElement(
          `M       ${decomposedLine}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'PermissionSet',
              member: 'Admin',
            }),
          ])
        )
        expect(result.copies.length).toBeGreaterThan(0)
      })

      it('When deletion with remaining files, Then returns Package manifest (treated as modification)', async () => {
        // Arrange
        const existingFiles = [
          'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
          'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
          'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
        ]
        mockedReadDirs.mockResolvedValue(existingFiles)

        const { changeType, element } = createElement(
          `D       ${decomposedLine}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'PermissionSet',
              member: 'Admin',
            }),
          ])
        )
        expect(result.copies.length).toBeGreaterThan(0)
      })

      it('When deletion with no remaining files, Then returns DestructiveChanges manifest', async () => {
        // Arrange
        mockedReadDirs.mockResolvedValue([])

        const { changeType, element } = createElement(
          `D       ${decomposedLine}`,
          globalMetadata.get('permissionsets')!,
          globalMetadata
        )
        const sut = new ContainedDecomposedHandler(changeType, element, work)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.DestructiveChanges,
              type: 'PermissionSet',
              member: 'Admin',
            }),
          ])
        )
        expect(result.copies).toHaveLength(0)
      })
    })

    it('Given decomposed addition with generateDelta false, When collect, Then no GitDirCopy in copies', async () => {
      // Arrange
      work.config.generateDelta = false
      const decomposedLine =
        'A       force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml'
      const { changeType, element } = createElement(
        decomposedLine,
        globalMetadata.get('permissionsets')!,
        globalMetadata
      )
      const sut = new ContainedDecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(
        result.copies.every(c => c.kind !== CopyOperationKind.GitDirCopy)
      ).toBe(true)
    })

    it('Given decomposed addition, When collect, Then includes holder folder GitDirCopy', async () => {
      // Arrange
      const decomposedLine =
        'A       force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml'
      const { changeType, element } = createElement(
        decomposedLine,
        globalMetadata.get('permissionsets')!,
        globalMetadata
      )
      const sut = new ContainedDecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'PermissionSet',
            member: 'Admin',
          }),
        ])
      )
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitDirCopy &&
            c.path.includes('permissionsets/Admin')
        )
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given non-decomposed addition, When collect, Then returns manifest and file copy without holder', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'A       force-app/main/permissionsets/Subject.permissionset-meta.xml',
        globalMetadata.get('permissionsets')!,
        globalMetadata
      )
      const sut = new ContainedDecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'PermissionSet',
            member: 'Subject',
          }),
        ])
      )
      expect(
        result.copies.every(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
