'use strict'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import GitAdapter from '../../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { getGlobalMetadata } from '../../../__utils__/globalTestHelper'

const mockListDirAtRevision =
  jest.fn<(dir: string, revision: string) => Promise<string[]>>()
const mockGitAdapter = {
  listDirAtRevision: mockListDirAtRevision,
} as unknown as GitAdapter

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getGlobalMetadata()
})

describe('MetadataBoundaryResolver', () => {
  let sut: MetadataBoundaryResolver

  beforeEach(() => {
    jest.clearAllMocks()
    sut = new MetadataBoundaryResolver(globalMetadata, mockGitAdapter)
  })

  describe('resolve', () => {
    describe('when file has known suffix (fast path)', () => {
      it('should return metadata for static resource with suffix in file name', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/MyResource.resource-meta.xml'
        const revision = 'HEAD'

        // Act
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).not.toBeNull()
        expect(result!.metadata.xmlName).toBe('StaticResource')
        expect(result!.componentName).toBe('MyResource')
        // parts = ['force-app', 'main', 'default', 'staticresources', 'MyResource.resource-meta.xml']
        // boundaryIndex = parts.length - 2 = 5 - 2 = 3
        expect(result!.boundaryIndex).toBe(3)
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should return metadata for Apex class', async () => {
        // Arrange
        const path = 'force-app/main/default/classes/MyClass.cls'
        const revision = 'HEAD'

        // Act
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).not.toBeNull()
        expect(result!.metadata.xmlName).toBe('ApexClass')
        expect(result!.componentName).toBe('MyClass')
        // parts = ['force-app', 'main', 'default', 'classes', 'MyClass.cls']
        // boundaryIndex = 5 - 2 = 3
        expect(result!.boundaryIndex).toBe(3)
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })

      it('should return metadata for Apex trigger', async () => {
        // Arrange
        const path = 'force-app/main/default/triggers/MyTrigger.trigger'
        const revision = 'HEAD'

        // Act
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).not.toBeNull()
        expect(result!.metadata.xmlName).toBe('ApexTrigger')
        expect(result!.componentName).toBe('MyTrigger')
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })
    })

    describe('when file does not have known suffix (hierarchy scan)', () => {
      it('should find metadata boundary from sibling with known suffix', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/MyResource/images/logo.png'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValueOnce(['logo.png', 'icon.svg'])
        mockListDirAtRevision.mockResolvedValueOnce(['images', 'styles'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).not.toBeNull()
        expect(result!.metadata.xmlName).toBe('StaticResource')
        expect(result!.componentName).toBe('MyResource')
        // parts = ['force-app', 'main', 'default', 'staticresources', 'MyResource', 'images', 'logo.png']
        // MyResource is at index 4
        expect(result!.boundaryIndex).toBe(4)
      })

      it('should cache directory listings', async () => {
        // Arrange
        const path1 =
          'force-app/main/default/staticresources/MyResource/images/logo.png'
        const path2 =
          'force-app/main/default/staticresources/MyResource/images/icon.svg'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValueOnce(['logo.png', 'icon.svg'])
        mockListDirAtRevision.mockResolvedValueOnce(['images', 'styles'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        await sut.resolve(path1, revision)
        await sut.resolve(path2, revision)

        // Assert - second call should use cache, so only 3 calls total
        expect(mockListDirAtRevision).toHaveBeenCalledTimes(3)
      })

      it('should return null when no metadata boundary found within depth limit', async () => {
        // Arrange
        const path = 'force-app/main/default/unknown/deep/nested/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValue(['file.txt'])

        // Act
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).toBeNull()
      })
    })

    describe('when staticresource is in non-standard location', () => {
      it('should resolve staticresource outside standard folder', async () => {
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
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).not.toBeNull()
        expect(result!.metadata.xmlName).toBe('StaticResource')
        expect(result!.componentName).toBe('MyAsset')
      })

      it('should resolve document in non-standard location', async () => {
        // Arrange
        const path = 'custom/docs/MyDoc/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValueOnce(['file.txt'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyDoc',
          'MyDoc.document-meta.xml',
        ])

        // Act
        const result = await sut.resolve(path, revision)

        // Assert
        expect(result).not.toBeNull()
        expect(result!.metadata.xmlName).toBe('Document')
        expect(result!.componentName).toBe('MyDoc')
      })
    })

    describe('when different revisions are used', () => {
      it('should separate cache by revision', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/MyResource/data.json'
        const revision1 = 'HEAD'
        const revision2 = 'feature-branch'

        // HEAD has the meta file
        mockListDirAtRevision.mockResolvedValueOnce(['data.json'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // feature-branch also needs its own lookup
        mockListDirAtRevision.mockResolvedValueOnce(['data.json'])
        mockListDirAtRevision.mockResolvedValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        await sut.resolve(path, revision1)
        await sut.resolve(path, revision2)

        // Assert - should be called 4 times (2 for each revision)
        expect(mockListDirAtRevision).toHaveBeenCalledTimes(4)
        expect(mockListDirAtRevision).toHaveBeenCalledWith(
          'force-app/main/default/staticresources/MyResource',
          revision1
        )
        expect(mockListDirAtRevision).toHaveBeenCalledWith(
          'force-app/main/default/staticresources/MyResource',
          revision2
        )
      })
    })
  })

  describe('extractName', () => {
    it('should extract name from file with -meta.xml suffix', async () => {
      // Arrange
      const path =
        'force-app/main/default/staticresources/Test.resource-meta.xml'
      const revision = 'HEAD'

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result!.componentName).toBe('Test')
    })

    it('should extract name from file without -meta.xml suffix', async () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'
      const revision = 'HEAD'

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result!.componentName).toBe('MyClass')
    })

    it('should handle complex names with dots', async () => {
      // Arrange
      const path = 'force-app/main/default/classes/My.Class.Name.cls'
      const revision = 'HEAD'

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result!.componentName).toBe('My.Class.Name')
    })
  })

  describe('findComponentIndex', () => {
    it('should find folder-based component by exact match', async () => {
      // Arrange
      const path = 'force-app/main/default/staticresources/MyResource/data.json'
      const revision = 'HEAD'
      mockListDirAtRevision.mockResolvedValueOnce(['data.json'])
      mockListDirAtRevision.mockResolvedValueOnce([
        'MyResource',
        'MyResource.resource-meta.xml',
      ])

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result).not.toBeNull()
      // parts = ['force-app', 'main', 'default', 'staticresources', 'MyResource', 'data.json']
      // MyResource is at index 4
      expect(result!.boundaryIndex).toBe(4)
    })

    it('should find file-based component by prefix match', async () => {
      // Arrange
      const path =
        'force-app/main/default/staticresources/MyResource.resource-meta.xml'
      const revision = 'HEAD'

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result).not.toBeNull()
      // parts = ['force-app', 'main', 'default', 'staticresources', 'MyResource.resource-meta.xml']
      // boundaryIndex = parts.length - 2 = 3
      expect(result!.boundaryIndex).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('should handle root-level paths', async () => {
      // Arrange
      const path = 'MyClass.cls'
      const revision = 'HEAD'

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result).not.toBeNull()
      expect(result!.componentName).toBe('MyClass')
    })

    it('should handle empty directory listings', async () => {
      // Arrange
      const path = 'force-app/main/default/unknown/nested/file.txt'
      const revision = 'HEAD'
      mockListDirAtRevision.mockResolvedValue([])

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      expect(result).toBeNull()
    })

    it('should stop at MAX_HIERARCHY_DEPTH', async () => {
      // Arrange
      const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/l/file.txt'
      const revision = 'HEAD'
      mockListDirAtRevision.mockResolvedValue(['file.txt'])

      // Act
      const result = await sut.resolve(deepPath, revision)

      // Assert
      expect(result).toBeNull()
      // Should only call up to MAX_HIERARCHY_DEPTH (10) times
      expect(mockListDirAtRevision).toHaveBeenCalledTimes(10)
    })

    it('should handle path ending at root directory', async () => {
      // Arrange
      const path = 'file.txt'
      const revision = 'HEAD'
      mockListDirAtRevision.mockResolvedValue(['file.txt'])

      // Act
      const result = await sut.resolve(path, revision)

      // Assert
      // Path 'file.txt' without known suffix, parent dir is '.' which should stop
      expect(result).toBeNull()
    })
  })
})
