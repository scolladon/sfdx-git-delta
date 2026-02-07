'use strict'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import GitAdapter from '../../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Metadata } from '../../../../src/types/metadata'
import { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'

const mockListDirAtRevision =
  jest.fn<(dir: string, revision: string) => Promise<string[]>>()
const mockGitAdapter = {
  listDirAtRevision: mockListDirAtRevision,
} as unknown as GitAdapter

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

const staticResourceType: Metadata = {
  directoryName: 'staticresources',
  inFolder: false,
  metaFile: true,
  suffix: 'resource',
  xmlName: 'StaticResource',
}

const lwcType: Metadata = {
  directoryName: 'lwc',
  inFolder: false,
  metaFile: false,
  suffix: '',
  xmlName: 'LightningComponentBundle',
}

describe('MetadataBoundaryResolver', () => {
  let sut: MetadataBoundaryResolver

  beforeEach(() => {
    jest.clearAllMocks()
    sut = new MetadataBoundaryResolver(globalMetadata, mockGitAdapter)
  })

  describe('createElement', () => {
    describe('when directoryName is in path (sync path)', () => {
      it('should resolve LWC component without git calls', async () => {
        // Arrange
        const path = 'force-app/main/default/lwc/myComponent/myComponent.js'
        const revision = 'HEAD'

        // Act
        const element = await sut.createElement(path, lwcType, revision)

        // Assert
        expect(element.componentName).toBe('myComponent')
        expect(element.type.xmlName).toBe('LightningComponentBundle')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should resolve nested StaticResource file without git calls', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/MyResource/images/logo.png'
        const revision = 'HEAD'

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('logo')
        expect(element.type.xmlName).toBe('StaticResource')
        expect(element.pathAfterType[0]).toBe('MyResource')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should resolve file directly in directoryName folder', async () => {
        // Arrange
        const path = 'force-app/main/default/staticresources/MyResource.png'
        const revision = 'HEAD'

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('MyResource')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should use lastIndexOf for nested directoryName paths', async () => {
        // Arrange
        const path =
          'force-app/main/default/lwc/sub_folder1/lwc/deeplyNestedComponent/deeplyNestedComponent.js'
        const revision = 'HEAD'

        // Act
        const element = await sut.createElement(path, lwcType, revision)

        // Assert
        expect(element.componentName).toBe('deeplyNestedComponent')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should resolve ExperienceBundle nested file without git calls', async () => {
        // Arrange
        const experienceBundleType: Metadata = {
          directoryName: 'experiences',
          inFolder: false,
          metaFile: true,
          suffix: 'site',
          xmlName: 'ExperienceBundle',
        }
        const path =
          'force-app/main/default/experiences/my_bundle/config/file.json'
        const revision = 'HEAD'

        // Act
        const element = await sut.createElement(
          path,
          experienceBundleType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('file')
        expect(element.pathAfterType[0]).toBe('my_bundle')
        expect(element.type.xmlName).toBe('ExperienceBundle')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should resolve Aura component file without git calls', async () => {
        // Arrange
        const auraType: Metadata = {
          directoryName: 'aura',
          inFolder: false,
          metaFile: false,
          suffix: '',
          xmlName: 'AuraDefinitionBundle',
        }
        const path =
          'force-app/main/default/aura/myComponent/myComponentHelper.js'
        const revision = 'HEAD'

        // Act
        const element = await sut.createElement(path, auraType, revision)

        // Assert
        expect(element.componentName).toBe('myComponentHelper')
        expect(element.pathAfterType[0]).toBe('myComponent')
        expect(element.type.xmlName).toBe('AuraDefinitionBundle')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })
    })

    describe('when directoryName is NOT in path (git scan fallback)', () => {
      it('should find metadata boundary from sibling with known suffix', async () => {
        // Arrange
        const path = 'force-app/main/any/path/here/MyAsset/images/logo.png'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValueOnce(['logo.png'])
        mockListDirAtRevision.mockResolvedValueOnce(['images', 'data'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyAsset',
          'MyAsset.resource-meta.xml',
        ])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('logo')
        expect(element.pathAfterType[0]).toBe('MyAsset')
        expect(mockListDirAtRevision).toHaveBeenCalled()
      })

      it('should resolve document in non-standard location', async () => {
        // Arrange
        const documentType: Metadata = {
          directoryName: 'documents',
          inFolder: true,
          metaFile: true,
          suffix: 'document',
          xmlName: 'Document',
        }
        const path = 'custom/docs/MyDoc/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValueOnce(['file.txt'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyDoc',
          'MyDoc.document-meta.xml',
        ])

        // Act
        const element = await sut.createElement(path, documentType, revision)

        // Assert
        expect(element.componentName).toBe('file')
      })

      it('should cache directory listings', async () => {
        // Arrange
        const path1 = 'force-app/main/any/path/MyResource/images/logo.png'
        const path2 = 'force-app/main/any/path/MyResource/images/icon.svg'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValueOnce(['logo.png', 'icon.svg'])
        mockListDirAtRevision.mockResolvedValueOnce(['images', 'styles'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        await sut.createElement(path1, staticResourceType, revision)
        await sut.createElement(path2, staticResourceType, revision)

        // Assert - second call should use cache, so only 3 calls total
        expect(mockListDirAtRevision).toHaveBeenCalledTimes(3)
      })

      it('should fallback to last segment when no metadata boundary found', async () => {
        // Arrange
        const path = 'force-app/main/default/unknown/deep/nested/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValue(['file.txt'])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert - falls back to last segment
        expect(element.componentName).toBe('file')
      })

      it('should separate cache by revision', async () => {
        // Arrange
        const path = 'force-app/main/any/path/MyResource/data.json'
        const revision1 = 'HEAD'
        const revision2 = 'feature-branch'

        mockListDirAtRevision.mockResolvedValueOnce(['data.json'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        mockListDirAtRevision.mockResolvedValueOnce(['data.json'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        await sut.createElement(path, staticResourceType, revision1)
        await sut.createElement(path, staticResourceType, revision2)

        // Assert - should be called 4 times (2 for each revision)
        expect(mockListDirAtRevision).toHaveBeenCalledTimes(4)
        expect(mockListDirAtRevision).toHaveBeenCalledWith(
          'force-app/main/any/path/MyResource',
          revision1
        )
        expect(mockListDirAtRevision).toHaveBeenCalledWith(
          'force-app/main/any/path/MyResource',
          revision2
        )
      })
    })

    describe('edge cases', () => {
      it('should handle empty directory listings', async () => {
        // Arrange
        const path = 'force-app/main/default/unknown/nested/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValue([])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert - falls back to last segment
        expect(element.componentName).toBe('file')
      })

      it('should stop at MAX_HIERARCHY_DEPTH', async () => {
        // Arrange
        const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/l/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValue(['file.txt'])

        // Act
        await sut.createElement(deepPath, staticResourceType, revision)

        // Assert - should only call up to MAX_HIERARCHY_DEPTH (10) times
        expect(mockListDirAtRevision).toHaveBeenCalledTimes(10)
      })

      it('should handle path ending at root directory', async () => {
        // Arrange
        const path = 'file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValue(['file.txt'])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert - parent dir is '.' which stops, falls back to last segment
        expect(element.componentName).toBe('file')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })
    })
  })
})
