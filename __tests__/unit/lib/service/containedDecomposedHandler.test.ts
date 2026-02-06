'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ContainedDecomposedHandler from '../../../../src/service/containedDecomposedHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readDirs } from '../../../../src/utils/fsHelper'
import type { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadDirs = jest.mocked(readDirs)
const mockResolver = {
  resolve: async () => null,
} as unknown as MetadataBoundaryResolver

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  work.config.generateDelta = true
})

describe('ContainedDecomposedHandler', () => {
  describe('when generateDelta is false', () => {
    it('addition does not copy files', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new ContainedDecomposedHandler(
        `A       force-app/main/permissionsets/Subject.permissionset-meta.xml`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )
      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Subject')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })

  describe.each([
    'permissionsets',
    'other',
    'permissionsets/subFolder',
  ])('when it is not decomposed', folder => {
    let line: string
    beforeEach(() => {
      line = `force-app/main/${folder}/Subject.permissionset-meta.xml`
    })

    it('should add addition to the package.xml', async () => {
      // Arrange
      const sut = new ContainedDecomposedHandler(
        `A       ${line}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )
      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Subject')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toHaveBeenCalledTimes(1)
    })

    it('should add modification to the package.xml', async () => {
      // Arrange
      const sut = new ContainedDecomposedHandler(
        `M       ${line}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )
      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Subject')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toHaveBeenCalledTimes(1)
    })

    it('should add deletion to the package.xml', async () => {
      // Arrange
      const sut = new ContainedDecomposedHandler(
        `D       ${line}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )
      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.has('PermissionSet')).toBe(false)
      expect(work.diffs.destructiveChanges.get('PermissionSet')).toContain(
        'Subject'
      )
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
  describe.each([
    'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
    'force-app/main/default/permissionsets/Admin/Admin.flowAccesses-meta.xml',
  ])('when it is decomposed', decomposedLine => {
    it(`should copy all decomposed files when adding a file for "${decomposedLine}"`, async () => {
      // Arrange
      const existingFiles = [
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
        'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
        'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
      ]
      mockedReadDirs.mockResolvedValue(existingFiles)

      const sut = new ContainedDecomposedHandler(
        `A       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Admin')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toHaveBeenCalledTimes(2)
    })

    it(`should copy all decomposed files when modifying a file for "${decomposedLine}"`, async () => {
      // Arrange
      const existingFiles = [
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
        'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
        'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
      ]
      mockedReadDirs.mockResolvedValue(existingFiles)

      const sut = new ContainedDecomposedHandler(
        `M       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Admin')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toHaveBeenCalledTimes(2)
    })

    it(`should handle deletion with remaining files as modification for "${decomposedLine}"`, async () => {
      // Arrange
      const existingFiles = [
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
        'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml',
        'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
      ]
      mockedReadDirs.mockResolvedValue(existingFiles)

      const sut = new ContainedDecomposedHandler(
        `D       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Admin')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toHaveBeenCalledTimes(2)
    })

    it(`should handle deletion with no remaining files as destructive change for "${decomposedLine}"`, async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])

      const sut = new ContainedDecomposedHandler(
        `D       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.has('PermissionSet')).toBe(false)
      expect(work.diffs.destructiveChanges.get('PermissionSet')).toContain(
        'Admin'
      )
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
})
