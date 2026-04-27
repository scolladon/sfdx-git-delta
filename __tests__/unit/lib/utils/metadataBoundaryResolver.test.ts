'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import GitAdapter from '../../../../src/adapter/GitAdapter'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Metadata } from '../../../../src/types/metadata'
import { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { MetadataElement } from '../../../../src/utils/metadataElement'

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
    // clearAllMocks does not drain queued mockResolvedValueOnce values; reset
    // the per-test mock queues so leftovers from a previous test cannot leak
    // into the next one and silently flip behaviour.
    mockGetFilesPath.mockReset()
    mockListDirAtRevision.mockReset()
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

  // --- Mutation-killing tests ---

  describe('createElement early returns (L38, L40)', () => {
    it('Given element without suffix (no-suffix type), When creating element, Then returns element immediately without scan (L34 !suffix)', async () => {
      // Mutant L34 ConditionalExpression false: skips early return → enters scan unnecessarily
      const noSuffixType: Metadata = {
        ...lwcType,
        suffix: undefined as unknown as string,
      }
      const path = 'force-app/main/default/lwc/myComponent/myComponent.js'
      const element = await sut.createElement(path, noSuffixType, 'HEAD')
      expect(element.componentName).toBe('myComponent')
      // No scan performed
      expect(mockGetFilesPath).not.toHaveBeenCalled()
      expect(mockListDirAtRevision).not.toHaveBeenCalled()
    })

    it('Given depth-2 path where file suffix matches type suffix (L38 ConditionalExpression false), When creating element, Then checks folder-name match', async () => {
      // path: .../permissionsets/Admin/Admin.permissionset-meta.xml
      // fileName = 'Admin.permissionset-meta.xml', includes '.permissionset'=true
      // Mutant false: skips includes check → goes to scanAndCreateElement
      const path =
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml'
      const element = await sut.createElement(path, permissionSetType, 'HEAD')
      expect(element.componentName).toBe('Admin')
      // folder matches component name → fromPath used directly (no scan)
      expect(mockGetFilesPath).not.toHaveBeenCalled()
      expect(mockListDirAtRevision).not.toHaveBeenCalled()
    })

    it('Given depth-2 path where file suffix does NOT match type suffix, When creating element, Then returns fromPath element (L38 ConditionalExpression true → always scans)', async () => {
      // fileName 'Admin.txt' does not include '.permissionset' → no scan
      // Mutant true: skips the includes guard → always enters the if-body
      const path = 'force-app/main/default/permissionsets/Admin/Admin.txt'
      const element = await sut.createElement(path, permissionSetType, 'HEAD')
      expect(element.componentName).toBe('Admin')
      expect(mockGetFilesPath).not.toHaveBeenCalled()
    })

    it('Given depth-2 with component name mismatch (L40), When creating element, Then uses fromScan', async () => {
      // pathAfterType = ['SomeFolder', 'OtherName.permissionset-meta.xml']
      // componentName extracted = 'OtherName', pathAfterType[0] = 'SomeFolder' → mismatch
      // Mutant "componentName !== element.pathAfterType[0]" → always returns element without fromScan
      const path =
        'force-app/main/default/permissionsets/SomeFolder/OtherName.permissionset-meta.xml'
      const element = await sut.createElement(path, permissionSetType, 'HEAD')
      // fromScan resolves 'OtherName' as anchor component
      expect(element.componentName).toBe('OtherName')
    })
  })

  describe('scanAndCreateElement dirIndex boundary (L64)', () => {
    it('Given typeDir in path with suffix (dirIndex >= 0 && suffix), When scanning, Then calls getFilesPath with typeDir', async () => {
      // Mutant "dirIndex > 0" would skip when dirIndex = 0
      const path =
        'force-app/main/default/staticresources/MyResource/nested/deep.txt'
      mockGetFilesPath.mockResolvedValueOnce([
        'force-app/main/default/staticresources/MyResource/MyResource.resource-meta.xml',
      ])
      await sut.createElement(path, staticResourceType, 'HEAD')
      expect(mockGetFilesPath).toHaveBeenCalledWith(
        'force-app/main/default/staticresources',
        'HEAD'
      )
    })

    it('Given typeDir at index 0 in path (dirIndex=0, suffix present, depth>2), When scanning, Then getFilesPath is called (L64 dirIndex > 0 mutant killed)', async () => {
      // path: 'staticresources/MyResource/images/logo.png' → dirIndex=0 → >= 0 passes, > 0 would fail
      const path = 'staticresources/MyResource/images/logo.png'
      mockGetFilesPath.mockResolvedValueOnce([
        'staticresources/MyResource/MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(mockGetFilesPath).toHaveBeenCalledWith('staticresources', 'HEAD')
      expect(element.componentPath).toContain('MyResource')
    })
  })

  describe('scanAndCreateElement pathAfterType loop (L82, L83)', () => {
    it('Given component is at index 0 of pathAfterType (i=0 >= 0), When scanning, Then found at boundary (L83 i > 0 mutant killed)', async () => {
      // pathAfterType = ['MyResource', 'deep.txt']
      // Loop: i = length-2 = 0 >= 0 → checks pathAfterType[0] = 'MyResource' → found!
      // Mutant "i > 0": skips i=0 → misses → fallback to last segment
      const path = 'force-app/main/default/staticresources/MyResource/deep.txt'
      mockGetFilesPath.mockResolvedValueOnce([
        'force-app/main/default/staticresources/MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // MyResource should be found at pathAfterType[0]
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given component scan finds name, When using fromScan, Then metaSuffix built correctly (L72 StringLiteral)', async () => {
      // metaSuffix = `.${suffix}${METAFILE_SUFFIX}` = `.resource-meta.xml`
      // Mutant "``": metaSuffix="" → all files match → wrong component extracted
      const path =
        'force-app/main/default/staticresources/MyResource/images/logo.png'
      mockGetFilesPath.mockResolvedValueOnce([
        'force-app/main/default/staticresources/MyResource/MyResource.resource-meta.xml',
        'force-app/main/default/staticresources/MyResource/images/logo.png',
        'force-app/main/default/staticresources/Other.txt',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // Only .resource-meta.xml files are counted → MyResource found
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given multiple components in scan result, When one matches path, Then correct component selected (L82 ArithOp)', async () => {
      // pathAfterType.slice(dirIndex+1), loop from length-2 down
      // Mutant "dirIndex - 1": wrong slice → wrong pathAfterType
      const path =
        'force-app/main/default/staticresources/nested/MyResource/deep.txt'
      mockGetFilesPath.mockResolvedValueOnce([
        'force-app/main/default/staticresources/nested/MyResource/MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(element.componentPath).toContain('MyResource')
    })
  })

  describe('isNameInPath (L135)', () => {
    it('Given part exactly equals componentName, When isNameInPath, Then returns true', () => {
      // Mutant EqualityOperator "part !== componentName" → always false for exact match
      const resolver = new MetadataBoundaryResolver(
        globalMetadata,
        mockGitAdapter
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['a', 'MyComponent', 'file.js'], 'MyComponent')
      expect(result).toBe(true)
    })

    it('Given part starts with componentName dot, When isNameInPath, Then returns true (L135 MethodExpression endsWith mutant)', async () => {
      // Mutant: part.endsWith(`${componentName}.`) → 'MyComponent.js'.endsWith('MyComponent.') = false → miss
      // Correct: startsWith → true
      const resolver = new MetadataBoundaryResolver(
        globalMetadata,
        mockGitAdapter
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['a', 'MyComponent.js'], 'MyComponent')
      expect(result).toBe(true)
    })

    it('Given part ends with dot-componentName (not starts), When isNameInPath, Then returns false', async () => {
      // Verifies startsWith is used, not endsWith (mutation contrast)
      const resolver = new MetadataBoundaryResolver(
        globalMetadata,
        mockGitAdapter
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['a', 'prefix.MyComponent'], 'MyComponent')
      expect(result).toBe(false)
    })

    it('Given part is empty string componentName, When isNameInPath, Then returns true via startsWith', async () => {
      // L135 StringLiteral `` mutant: componentName.= `` → startsWith('.') for non-empty parts
      // Real behavior: componentName='' → part === '' or part.startsWith('.') → only empty-named matches
      const resolver = new MetadataBoundaryResolver(
        globalMetadata,
        mockGitAdapter
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['exact'], 'exact')
      expect(result).toBe(true)
    })
  })

  describe('createElement L38/L40 fromScan vs fromPath (mutation contrast)', () => {
    // For depth-2 paths where the suffix matches AND the folder name matches
    // the extracted component name, real returns the fromPath element
    // (no scan). The L40 mutants flip this: 'true' / 'false' / EqualityOperator
    // / BlockStatement all force fromScan to fire — verify by spying on the
    // static. fromPath is also spied so the contrast is observable both ways.
    it('Given depth-2 path where folder == componentName, When createElement, Then fromScan is NOT called (kills L40 mutants 110/111/112)', async () => {
      const fromScanSpy = vi.spyOn(MetadataElement, 'fromScan')
      const path =
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml'
      await sut.createElement(path, permissionSetType, 'HEAD')
      expect(fromScanSpy).not.toHaveBeenCalled()
      fromScanSpy.mockRestore()
    })

    it('Given depth-2 path where folder != componentName, When createElement, Then fromScan IS called with extracted name (kills L40 mutant 109 + L38 mutants 106/108)', async () => {
      // L38 mutant cond=false / block={} — both bypass the folder-mismatch
      //   check entirely and return element via fromPath.
      // L40 mutant cond=true (id=109) — always returns element, never fromScan.
      // All three diverge from real on the mismatch path: real calls fromScan
      // with the extracted component name (here 'OtherName').
      const fromScanSpy = vi.spyOn(MetadataElement, 'fromScan')
      const path =
        'force-app/main/default/permissionsets/SomeFolder/OtherName.permissionset-meta.xml'
      await sut.createElement(path, permissionSetType, 'HEAD')
      expect(fromScanSpy).toHaveBeenCalledOnce()
      // Pin the third arg (componentName) so the EqualityOperator mutant —
      // which calls fromScan with the FOLDER name instead — also dies.
      expect(fromScanSpy).toHaveBeenCalledWith(
        path,
        permissionSetType,
        expect.anything(),
        'OtherName'
      )
      fromScanSpy.mockRestore()
    })
  })

  describe('scanAndCreateElement metaSuffix filtering (L72/L76 mutation contrast)', () => {
    // Both id=126 (metaSuffix → ``) and id=128 (file.endsWith → true) cause
    // every file to feed componentNames (not just `*.${suffix}-meta.xml`).
    // Construct a scenario where a non-meta file's name matches a directory
    // segment in the path: real scan ignores it (suffix filter), mutant
    // returns it as the metadata boundary — observable on componentPath.
    it('Given non-meta file shares a name with a path segment, When scanning, Then it is ignored (kills L72/L76 mutants 126/128)', async () => {
      // Depth must be > 2 to force the scanAndCreateElement branch — at
      // depth-2 the createElement shortcut returns fromPath without scanning.
      const path =
        'force-app/main/default/staticresources/wrongmatch/sub/file.bin'
      mockGetFilesPath.mockResolvedValueOnce([
        // Non-meta file whose extracted name ('wrongmatch') matches the
        // intermediate directory in the path. The suffix guard is the only
        // line of defence against this collision.
        'force-app/main/default/staticresources/wrongmatch',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // Real: empty componentNames → fallback to parse(path).name='file' →
      //       fromScan('file') → anchor at file index → componentPath = full path.
      // Mutant: componentNames includes 'wrongmatch' → fromScan('wrongmatch')
      //         → anchor at 'wrongmatch' index → componentPath='.../wrongmatch'.
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/wrongmatch/sub/file.bin'
      )
    })
  })

  describe('scanAndCreateElement loop bounds (L82/L83 mutation contrast)', () => {
    it('Given typeDir at index >= 1 and a pre-dir part collides with a component name, When scanning, Then only post-typeDir parts are searched (kills L82 MethodExpression mutant 132)', async () => {
      // Mutant id=132: `parts.slice(dirIndex+1)` becomes `parts` — the loop
      // sees segments BEFORE the typeDir. We exploit that with a pre-dir
      // segment ('foo') that matches a meta-derived componentName.
      const path = 'foo/staticresources/A/B/file.bin'
      mockGetFilesPath.mockResolvedValueOnce([
        'staticresources/foo.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // Real pathAfterType=['A','B','file.bin']; 'foo' is NOT in it → loop
      //       finds nothing → fallback to fromScan('file') → componentPath
      //       = full path.
      // Mutant pathAfterType=full parts; 'foo' at index 0 matches → fromScan
      //       ('foo') → componentPath='foo'.
      expect(element.componentPath).toBe('foo/staticresources/A/B/file.bin')
    })

    it('Given typeDir at index 0, When scanning, Then dirIndex+1 slice yields the post-type parts (kills L82 ArithmeticOperator mutant 133)', async () => {
      // Mutant id=133: `parts.slice(dirIndex+1)` becomes `parts.slice(dirIndex-1)`.
      // For dirIndex=0 the mutated slice is parts.slice(-1) (just the file)
      // and the for-loop `length - 2 = -1` skips entirely → fallback fires
      // even though a perfectly matching component is two folders up.
      const path = 'staticresources/A/B/file.bin'
      mockGetFilesPath.mockResolvedValueOnce([
        'staticresources/A.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // Real: pathAfterType=['A','B','file.bin'], finds 'A' at i=0 → fromScan
      //       ('A') → componentPath='staticresources/A'.
      // Mutant: pathAfterType=['file.bin'], no iterations → fallback fromScan
      //       ('file') → componentPath = full path.
      expect(element.componentPath).toBe('staticresources/A')
    })

    it('Given last pathAfterType element matches a componentName, When scanning, Then it is excluded from the loop (kills L83 ArithmeticOperator mutant 134)', async () => {
      // Mutant id=134: loop start `length - 2` becomes `length + 2`. The
      // surplus iterations include i=length-1 (the file), so a meta file
      // sharing the file's basename is wrongly chosen as the boundary.
      const path = 'staticresources/A/B/foo.bin'
      mockGetFilesPath.mockResolvedValueOnce([
        // Meta file for the *folder* component the loop should pick…
        'staticresources/A.resource-meta.xml',
        // …and a meta file whose extracted name collides with the FILE name.
        'staticresources/foo.bin.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // Real: loop starts at length-2=1 ('B' not in set), then i=0 'A' found
      //       → fromScan('A') → componentPath='staticresources/A'.
      // Mutant: loop starts at length+2=5 (undefined), reaches i=2 'foo.bin'
      //         in set → fromScan('foo.bin') → componentPath = full path.
      expect(element.componentPath).toBe('staticresources/A')
    })
  })

  describe('findComponentName suffix-guard (L147 mutation contrast)', () => {
    it('Given a directory-named sibling whose name lacks the type-suffix dot-prefix, When walking, Then it is skipped (kills L147 StringLiteral mutant 173)', async () => {
      // Mutant id=173 collapses ``.${siblingMetadata.suffix}`` to ``''``,
      // turning `sibling.includes('.${suffix}')` into `sibling.includes('')`
      // — every sibling with metadata.suffix passes the guard. We force the
      // dir-walk branch (custom dir name not in path) and seed the parent
      // listing with a real metadata directoryName ('staticresources') that
      // is also a path part. Real: skip → fallback to file basename. Mutant:
      // accept it as the metadata boundary and anchor on it.
      const customType: Metadata = {
        directoryName: 'NEVER_IN_PATH',
        suffix: 'ext',
        metaFile: false,
        inFolder: false,
        xmlName: 'Custom',
      }
      const path = 'parent/staticresources/file.bin'
      mockListDirAtRevision.mockImplementation(dir => {
        if (dir === 'parent/staticresources') {
          return Promise.resolve(['file.bin'])
        }
        if (dir === 'parent') {
          return Promise.resolve(['staticresources', 'other'])
        }
        return Promise.resolve([])
      })
      const element = await sut.createElement(path, customType, 'HEAD')
      // Real componentPath = '${typeDirectoryPath}/${componentName}'
      //   = 'parent/staticresources/file'
      // Mutant componentPath = 'parent/staticresources' (fromScan anchor=1)
      expect(element.componentPath).toBe('parent/staticresources/file')
    })
  })

  describe('findComponentName (L147, L150)', () => {
    it('Given sibling with matching suffix and name in path, When findComponentName, Then returns name', async () => {
      // path through real scan
      const path = 'force-app/main/any/MyResource/images/logo.png'
      mockListDirAtRevision.mockResolvedValueOnce(['logo.png'])
      mockListDirAtRevision.mockResolvedValueOnce(['images'])
      mockListDirAtRevision.mockResolvedValueOnce([
        'MyResource',
        'MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(element.pathAfterType[0]).toBe('MyResource')
    })

    it('Given sibling suffix present but name NOT in path, When findComponentName, Then skips it (L150 ConditionalExpression true)', async () => {
      // Mutant true: isNameInPath always returns true → first sibling taken regardless
      // Real: OtherName is not in path → skipped, MyResource found later
      const path = 'force-app/main/any/MyResource/images/logo.png'
      mockListDirAtRevision.mockResolvedValueOnce(['logo.png'])
      mockListDirAtRevision.mockResolvedValueOnce(['images'])
      mockListDirAtRevision.mockResolvedValueOnce([
        'OtherResource',
        'OtherResource.resource-meta.xml',
        'MyResource',
        'MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // OtherResource not in path → skipped; MyResource is in path → found
      expect(element.pathAfterType[0]).toBe('MyResource')
    })
  })
})
