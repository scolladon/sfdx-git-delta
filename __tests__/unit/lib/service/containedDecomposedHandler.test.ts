'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import ContainedDecomposedHandler from '../../../../src/service/containedDecomposedHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readDir } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadDir = jest.mocked(readDir)

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getGlobalMetadata()
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  work.config.generateDelta = true
})

describe('ContainedDecomposedHandler', () => {
  describe.each(['permissionsets', 'other', 'permissionsets/subFolder'])(
    'when it is not decomposed',
    folder => {
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
          globalMetadata
        )
        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.get('PermissionSet')).toContain('Subject')
        expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
        expect(copyFiles).toBeCalledTimes(1)
      })

      it('should add modification to the package.xml', async () => {
        // Arrange
        const sut = new ContainedDecomposedHandler(
          `M       ${line}`,
          globalMetadata.get('permissionsets')!,
          work,
          globalMetadata
        )
        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.get('PermissionSet')).toContain('Subject')
        expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
        expect(copyFiles).toBeCalledTimes(1)
      })

      it('should add deletion to the package.xml', async () => {
        // Arrange
        const sut = new ContainedDecomposedHandler(
          `D       ${line}`,
          globalMetadata.get('permissionsets')!,
          work,
          globalMetadata
        )
        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.has('PermissionSet')).toBe(false)
        expect(work.diffs.destructiveChanges.get('PermissionSet')).toContain(
          'Subject'
        )
        expect(copyFiles).not.toBeCalled()
      })
    }
  )
  describe('when it is decomposed', () => {
    it('should copy all decomposed files when adding a file', async () => {
      // Arrange
      const decomposedLine =
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml'
      const existingFiles = [
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml',
        'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
      ]
      mockedReadDir.mockResolvedValue(existingFiles)

      const sut = new ContainedDecomposedHandler(
        `A       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Admin')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toBeCalledTimes(2)
    })

    it('should copy all decomposed files when modifying a file', async () => {
      // Arrange
      const decomposedLine =
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml'
      const existingFiles = [
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml',
        'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
      ]
      mockedReadDir.mockResolvedValue(existingFiles)

      const sut = new ContainedDecomposedHandler(
        `M       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Admin')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toBeCalledTimes(2)
    })

    it('should handle deletion with remaining files as modification', async () => {
      // Arrange
      const decomposedLine =
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml'
      const existingFiles = [
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml',
        'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Name.fieldPermissions-meta.xml',
      ]
      mockedReadDir.mockResolvedValue(existingFiles)

      const sut = new ContainedDecomposedHandler(
        `D       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get('PermissionSet')).toContain('Admin')
      expect(work.diffs.destructiveChanges.has('PermissionSet')).toBe(false)
      expect(copyFiles).toBeCalledTimes(2)
    })

    it('should handle deletion with no remaining files as destructive change', async () => {
      // Arrange
      const decomposedLine =
        'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermissions-meta.xml'
      mockedReadDir.mockResolvedValue([])

      const sut = new ContainedDecomposedHandler(
        `D       ${decomposedLine}`,
        globalMetadata.get('permissionsets')!,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.has('PermissionSet')).toBe(false)
      expect(work.diffs.destructiveChanges.get('PermissionSet')).toContain(
        'Admin'
      )
      expect(copyFiles).not.toBeCalled()
    })
  })
})
