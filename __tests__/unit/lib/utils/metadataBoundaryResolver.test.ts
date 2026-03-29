'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import GitAdapter from '../../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Metadata } from '../../../../src/types/metadata'
import { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'

const mockListDirAtRevision =
  vi.fn<(dir: string, revision: string) => Promise<string[]>>()
const mockGetFilesPath =
  vi.fn<(paths: string | string[], revision?: string) => Promise<string[]>>()
const mockGitAdapter = {
  listDirAtRevision: mockListDirAtRevision,
  getFilesPath: mockGetFilesPath,
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

const auraType: Metadata = {
  directoryName: 'aura',
  inFolder: false,
  metaFile: false,
  suffix: '',
  xmlName: 'AuraDefinitionBundle',
}

const permissionSetType: Metadata = {
  directoryName: 'permissionsets',
  inFolder: false,
  metaFile: true,
  suffix: 'permissionset',
  xmlName: 'PermissionSet',
}

const objectTranslationType: Metadata = {
  directoryName: 'objectTranslations',
  inFolder: false,
  metaFile: true,
  suffix: 'objectTranslation',
  xmlName: 'CustomObjectTranslation',
}

const botType: Metadata = {
  directoryName: 'bots',
  inFolder: false,
  metaFile: true,
  suffix: 'bot',
  xmlName: 'Bot',
}

const experienceBundleType: Metadata = {
  directoryName: 'experiences',
  inFolder: false,
  metaFile: true,
  suffix: 'site',
  xmlName: 'ExperienceBundle',
}

describe('MetadataBoundaryResolver', () => {
  let sut: MetadataBoundaryResolver

  beforeEach(() => {
    vi.clearAllMocks()
    sut = new MetadataBoundaryResolver(globalMetadata, mockGitAdapter)
  })

  describe('createElement', () => {
    describe('Given flat path (pathAfterType.length <= 1)', () => {
      it('Given flat file, When creating element, Then should use fromPath without scan', async () => {
        // Arrange
        const path = 'force-app/main/default/staticresources/MyResource.png'
        const revision = 'HEAD'

        // Act
        const element = await new MetadataBoundaryResolver(
          globalMetadata,
          mockGitAdapter
        ).createElement(path, staticResourceType, revision)

        // Assert
        expect(element.componentName).toBe('MyResource')
        expect(mockGetFilesPath).not.toHaveBeenCalled()
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })
    })

    describe('Given deep path (pathAfterType.length >= 2)', () => {
      describe('When type directory is in path without intermediate folders', () => {
        it('Given LWC component, When creating element, Then should use fromPath without scan', async () => {
          // Arrange
          const path = 'force-app/main/default/lwc/myComponent/myComponent.js'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(path, lwcType, revision)

          // Assert
          expect(element.componentName).toBe('myComponent')
          expect(element.type.xmlName).toBe('LightningComponentBundle')
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })

        it('Given StaticResource nested file, When creating element, Then should use getFilesPath to find component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/staticresources/MyResource/images/logo.png'
          const revision = 'HEAD'
          mockGetFilesPath.mockResolvedValueOnce([
            'force-app/main/default/staticresources/MyResource/MyResource.resource-meta.xml',
            'force-app/main/default/staticresources/MyResource/images/logo.png',
          ])

          // Act
          const element = await sut.createElement(
            path,
            staticResourceType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('logo')
          expect(element.type.xmlName).toBe('StaticResource')
          expect(mockGetFilesPath).toHaveBeenCalledWith(
            'force-app/main/default/staticresources',
            revision
          )
        })

        it('Given nested directoryName paths, When creating element, Then should use lastIndexOf without scan', async () => {
          // Arrange
          const path =
            'force-app/main/default/lwc/sub_folder1/lwc/deeplyNestedComponent/deeplyNestedComponent.js'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(path, lwcType, revision)

          // Assert
          expect(element.componentName).toBe('deeplyNestedComponent')
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })

        it('Given StaticResource content file at depth 2, When creating element, Then should use fromPath without scan', async () => {
          // Arrange
          const path =
            'force-app/main/default/staticresources/MyResource/logo.png'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(
            path,
            staticResourceType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('logo')
          expect(element.componentPath).toBe(
            'force-app/main/default/staticresources/MyResource'
          )
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })

        it('Given standard depth-2 suffix match, When folder matches component name, Then should use fromPath without scan', async () => {
          // Arrange
          const path =
            'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(
            path,
            permissionSetType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('Admin')
          expect(element.componentPath).toBe(
            'force-app/main/default/permissionsets/Admin'
          )
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })

        it('Given ExperienceBundle nested file, When creating element, Then should use getFilesPath to find component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/experiences/my_bundle/config/file.json'
          const revision = 'HEAD'
          mockGetFilesPath.mockResolvedValueOnce([
            'force-app/main/default/experiences/my_bundle/my_bundle.site-meta.xml',
            'force-app/main/default/experiences/my_bundle/config/file.json',
          ])

          // Act
          const element = await sut.createElement(
            path,
            experienceBundleType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('file')
          expect(element.componentPath).toBe(
            'force-app/main/default/experiences/my_bundle'
          )
          expect(element.type.xmlName).toBe('ExperienceBundle')
          expect(mockGetFilesPath).toHaveBeenCalledWith(
            'force-app/main/default/experiences',
            revision
          )
        })

        it('Given Aura component file, When creating element, Then should use fromPath without scan', async () => {
          // Arrange
          const path =
            'force-app/main/default/aura/myComponent/myComponentHelper.js'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(path, auraType, revision)

          // Assert
          expect(element.componentName).toBe('myComponentHelper')
          expect(element.type.xmlName).toBe('AuraDefinitionBundle')
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })
      })

      describe('When intermediate folders exist between type dir and component', () => {
        it('Given PermissionSet flat file with nesting, When creating element, Then should extract component from file name without scan', async () => {
          // Arrange
          const path =
            'force-app/main/default/permissionsets/marketing/Admin.permissionset-meta.xml'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(
            path,
            permissionSetType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('Admin')
          expect(element.type.xmlName).toBe('PermissionSet')
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })

        it('Given PermissionSet decomposed file with nesting, When creating element, Then should find correct component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/permissionsets/marketing/Admin/fieldPermissions/Account.fieldPermission-meta.xml'
          const revision = 'HEAD'
          mockGetFilesPath.mockResolvedValueOnce([
            'force-app/main/default/permissionsets/marketing/Admin/Admin.permissionset-meta.xml',
            'force-app/main/default/permissionsets/marketing/Admin/fieldPermissions/Account.fieldPermission-meta.xml',
          ])

          // Act
          const element = await sut.createElement(
            path,
            permissionSetType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('Account')
          expect(element.componentPath).toBe(
            'force-app/main/default/permissionsets/marketing/Admin'
          )
          expect(mockGetFilesPath).toHaveBeenCalledWith(
            'force-app/main/default/permissionsets',
            revision
          )
        })

        it('Given StaticResource with nesting, When creating element, Then should find correct component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/staticresources/nested/MyResource/images/logo.png'
          const revision = 'HEAD'
          mockGetFilesPath.mockResolvedValueOnce([
            'force-app/main/default/staticresources/nested/MyResource/MyResource.resource-meta.xml',
            'force-app/main/default/staticresources/nested/MyResource/images/logo.png',
          ])

          // Act
          const element = await sut.createElement(
            path,
            staticResourceType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('logo')
          expect(element.componentPath).toBe(
            'force-app/main/default/staticresources/nested/MyResource'
          )
          expect(mockGetFilesPath).toHaveBeenCalledWith(
            'force-app/main/default/staticresources',
            revision
          )
        })

        it('Given LWC with nesting, When creating element, Then should use fromPath without scan', async () => {
          // Arrange
          const path =
            'force-app/main/default/lwc/nested/myComponent/myComponent.js'
          const revision = 'HEAD'

          // Act
          const element = await sut.createElement(path, lwcType, revision)

          // Assert
          expect(element.componentName).toBe('myComponent')
          expect(mockGetFilesPath).not.toHaveBeenCalled()
          expect(mockListDirAtRevision).not.toHaveBeenCalled()
        })

        it('Given ObjectTranslation with nesting, When creating element, Then should find correct component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/objectTranslations/nested/Account-es/BillingFloor__c.fieldTranslation-meta.xml'
          const revision = 'HEAD'
          mockGetFilesPath.mockResolvedValueOnce([
            'force-app/main/default/objectTranslations/nested/Account-es.objectTranslation-meta.xml',
            'force-app/main/default/objectTranslations/nested/Account-es/BillingFloor__c.fieldTranslation-meta.xml',
          ])

          // Act
          const element = await sut.createElement(
            path,
            objectTranslationType,
            revision
          )

          // Assert
          expect(element.componentName).toBe('BillingFloor__c')
          expect(element.componentPath).toBe(
            'force-app/main/default/objectTranslations/nested/Account-es'
          )
          expect(mockGetFilesPath).toHaveBeenCalledWith(
            'force-app/main/default/objectTranslations',
            revision
          )
        })

        it('Given Bot with nesting, When creating element, Then should find correct component root via getFilesPath', async () => {
          // Arrange
          const path =
            'force-app/main/default/bots/nested/TestBot/v1.botVersion-meta.xml'
          const revision = 'HEAD'
          mockGetFilesPath.mockResolvedValueOnce([
            'force-app/main/default/bots/nested/TestBot/TestBot.bot-meta.xml',
            'force-app/main/default/bots/nested/TestBot/v1.botVersion-meta.xml',
          ])

          // Act
          const element = await sut.createElement(path, botType, revision)

          // Assert
          expect(element.componentName).toBe('v1')
          expect(element.componentPath).toBe(
            'force-app/main/default/bots/nested/TestBot'
          )
          expect(mockGetFilesPath).toHaveBeenCalledWith(
            'force-app/main/default/bots',
            revision
          )
        })
      })
    })

    describe('When directoryName is NOT in path (git scan fallback)', () => {
      it('Given sibling with known suffix, When creating element, Then should find metadata boundary', async () => {
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

      it('Given document in non-standard location, When creating element, Then should resolve component', async () => {
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

      it('Given two files in same directory, When creating elements, Then should cache directory listings', async () => {
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

      it('Given sibling name not in path, When creating element, Then should skip it and continue walking', async () => {
        // Arrange
        const path = 'force-app/main/any/path/here/MyAsset/images/logo.png'
        const revision = 'HEAD'
        mockListDirAtRevision.mockImplementation(dir => {
          if (dir === 'force-app/main/any/path/here') {
            return Promise.resolve([
              'OtherAsset',
              'OtherAsset.resource-meta.xml',
            ])
          }
          if (dir === 'force-app/main/any/path') {
            return Promise.resolve(['here', 'MyAsset.resource-meta.xml'])
          }
          return Promise.resolve([])
        })

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('logo')
      })

      it('Given no metadata boundary found, When creating element, Then should fallback to last segment', async () => {
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

      it('Given different revisions, When creating elements, Then should separate cache by revision', async () => {
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

    describe('When multiple metadata siblings exist at same directory level', () => {
      it('Given first sibling name not in path, When creating element, Then should skip it and find correct component', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/UpdateStaticResourceFile/resource/resource-file.txt'
        const revision = 'HEAD'
        mockGetFilesPath.mockResolvedValueOnce([
          'force-app/main/default/staticresources/Ignored.resource-meta.xml',
          'force-app/main/default/staticresources/UpdateStaticResourceFile.resource-meta.xml',
          'force-app/main/default/staticresources/UpdateStaticResourceFile/resource/resource-file.txt',
        ])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('resource-file')
        expect(element.componentPath).toBe(
          'force-app/main/default/staticresources/UpdateStaticResourceFile'
        )
      })
    })

    describe('edge cases', () => {
      it('Given getFilesPath throws, When creating element with typeDir in path, Then should fallback to last segment', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/MyResource/images/logo.png'
        const revision = 'HEAD'
        mockGetFilesPath.mockRejectedValueOnce(new Error('git error'))

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert - falls back to last segment
        expect(element.componentName).toBe('logo')
      })

      it('Given no matching meta files, When creating element with typeDir in path, Then should fallback to last segment', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/unknown/nested/file.txt'
        const revision = 'HEAD'
        mockGetFilesPath.mockResolvedValueOnce([
          'force-app/main/default/staticresources/unknown/nested/file.txt',
        ])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert - falls back to last segment
        expect(element.componentName).toBe('file')
      })

      it('Given empty directory listings, When creating element without typeDir, Then should fallback to last segment', async () => {
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

      it('Given deep path without typeDir, When creating element, Then should walk up to root', async () => {
        // Arrange
        const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/l/file.txt'
        const revision = 'HEAD'
        mockListDirAtRevision.mockResolvedValue(['file.txt'])

        // Act
        await sut.createElement(deepPath, staticResourceType, revision)

        // Assert - walks all 12 levels (dirname from l/ up to a/, then '.' stops)
        expect(mockListDirAtRevision).toHaveBeenCalledTimes(12)
      })

      it('Given path at root directory, When creating element, Then should resolve without scan', async () => {
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
        expect(mockGetFilesPath).not.toHaveBeenCalled()
        expect(mockListDirAtRevision).not.toHaveBeenCalled()
      })
    })
  })
})
