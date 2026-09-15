'use strict'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { TreeReader } from '../../../../src/adapter/treeReader'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Metadata } from '../../../../src/types/metadata'
import { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { MetadataElement } from '../../../../src/utils/metadataElement'
import { getContext } from '../../../__utils__/testWork'

// MetadataBoundaryResolver now takes the run-owned TreeReader instead of
// (config, gitAdapter) — filesUnder/children are plain synchronous methods
// that take the revision as their own first argument (no scope object, and
// no separate per-revision lookup, to thread through any more).
const mockFilesUnder =
  vi.fn<(revision: string, paths: string | string[]) => string[]>()
const mockChildren = vi.fn<(revision: string, dir: string) => string[]>()
const treeReader = {
  pathExists: vi.fn(),
  filesUnder: mockFilesUnder,
  children: mockChildren,
} as unknown as TreeReader

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
    // clearAllMocks does not drain queued mockReturnValueOnce values, nor a
    // persistent mockReturnValue override — reset the per-test mock queues
    // so leftovers from a previous test cannot leak into the next one and
    // silently flip behaviour.
    mockFilesUnder.mockReset()
    mockChildren.mockReset()
    sut = new MetadataBoundaryResolver(
      getContext({ metadata: globalMetadata, trees: treeReader })
    )
  })

  // Spies on shared objects (MetadataElement statics, the global registry)
  // must be restored even when an assertion fails first, or they leak into
  // every later test in the file.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createElement', () => {
    describe('Given flat path (pathAfterType.length <= 1)', () => {
      it('Given flat file, When creating element, Then should use fromPath without scan', async () => {
        // Arrange
        const path = 'force-app/main/default/staticresources/MyResource.png'
        const revision = 'HEAD'

        // Act
        const element = await new MetadataBoundaryResolver(
          getContext({ metadata: globalMetadata, trees: treeReader })
        ).createElement(path, staticResourceType, revision)

        // Assert
        expect(element.componentName).toBe('MyResource')
        expect(mockFilesUnder).not.toHaveBeenCalled()
        expect(mockChildren).not.toHaveBeenCalled()
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
        })

        it('Given StaticResource nested file, When creating element, Then componentNamesUnder finds the component root in the type directory listing', async () => {
          // Arrange
          const path =
            'force-app/main/default/staticresources/MyResource/images/logo.png'
          const revision = 'HEAD'
          mockFilesUnder.mockReturnValueOnce([
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
          expect(mockFilesUnder).toHaveBeenCalledWith(
            revision,
            'force-app/main/default/staticresources'
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
        })

        it('Given ExperienceBundle nested file, When creating element, Then componentNamesUnder finds the component root in the type directory listing', async () => {
          // Arrange
          const path =
            'force-app/main/default/experiences/my_bundle/config/file.json'
          const revision = 'HEAD'
          mockFilesUnder.mockReturnValueOnce([
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
          expect(mockFilesUnder).toHaveBeenCalledWith(
            revision,
            'force-app/main/default/experiences'
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
        })

        it('Given PermissionSet decomposed file with nesting, When creating element, Then should find correct component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/permissionsets/marketing/Admin/fieldPermissions/Account.fieldPermission-meta.xml'
          const revision = 'HEAD'
          mockFilesUnder.mockReturnValueOnce([
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
          expect(mockFilesUnder).toHaveBeenCalledWith(
            revision,
            'force-app/main/default/permissionsets'
          )
        })

        it('Given StaticResource with nesting, When creating element, Then should find correct component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/staticresources/nested/MyResource/images/logo.png'
          const revision = 'HEAD'
          mockFilesUnder.mockReturnValueOnce([
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
          expect(mockFilesUnder).toHaveBeenCalledWith(
            revision,
            'force-app/main/default/staticresources'
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
          expect(mockFilesUnder).not.toHaveBeenCalled()
          expect(mockChildren).not.toHaveBeenCalled()
        })

        it('Given ObjectTranslation with nesting, When creating element, Then should find correct component root', async () => {
          // Arrange
          const path =
            'force-app/main/default/objectTranslations/nested/Account-es/BillingFloor__c.fieldTranslation-meta.xml'
          const revision = 'HEAD'
          mockFilesUnder.mockReturnValueOnce([
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
          expect(mockFilesUnder).toHaveBeenCalledWith(
            revision,
            'force-app/main/default/objectTranslations'
          )
        })

        it('Given Bot with nesting, When creating element, Then componentNamesUnder finds the correct component root in the type directory listing', async () => {
          // Arrange
          const path =
            'force-app/main/default/bots/nested/TestBot/v1.botVersion-meta.xml'
          const revision = 'HEAD'
          mockFilesUnder.mockReturnValueOnce([
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
          expect(mockFilesUnder).toHaveBeenCalledWith(
            revision,
            'force-app/main/default/bots'
          )
        })
      })
    })

    describe('When directoryName is NOT in path (git scan fallback)', () => {
      it('Given sibling with known suffix, When creating element, Then should find metadata boundary', async () => {
        // Arrange
        const path = 'force-app/main/any/path/here/MyAsset/images/logo.png'
        const revision = 'HEAD'
        mockChildren.mockReturnValueOnce(['logo.png'])
        mockChildren.mockReturnValueOnce(['images', 'data'])
        mockChildren.mockReturnValueOnce([
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
        expect(mockChildren).toHaveBeenCalled()
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
        mockChildren.mockReturnValueOnce(['file.txt'])
        mockChildren.mockReturnValueOnce(['MyDoc', 'MyDoc.document-meta.xml'])

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
        mockChildren.mockReturnValueOnce(['logo.png', 'icon.svg'])
        mockChildren.mockReturnValueOnce(['images', 'styles'])
        mockChildren.mockReturnValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        await sut.createElement(path1, staticResourceType, revision)
        await sut.createElement(path2, staticResourceType, revision)

        // Assert - second call should use cache, so only 3 calls total
        expect(mockChildren).toHaveBeenCalledTimes(3)
      })

      it('Given sibling name not in path, When creating element, Then should skip it and continue walking', async () => {
        // Arrange
        const path = 'force-app/main/any/path/here/MyAsset/images/logo.png'
        const revision = 'HEAD'
        mockChildren.mockImplementation((_revision, dir) => {
          if (dir === 'force-app/main/any/path/here') {
            return ['OtherAsset', 'OtherAsset.resource-meta.xml']
          }
          if (dir === 'force-app/main/any/path') {
            return ['here', 'MyAsset.resource-meta.xml']
          }
          return []
        })

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert
        expect(element.componentName).toBe('logo')
        expect(element.pathAfterType[0]).toBe('MyAsset')
      })

      it('Given no metadata boundary found, When creating element, Then should fallback to last segment', async () => {
        // Arrange
        const path = 'force-app/main/default/unknown/deep/nested/file.txt'
        const revision = 'HEAD'
        mockChildren.mockReturnValue(['file.txt'])

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

        mockChildren.mockReturnValueOnce(['data.json'])
        mockChildren.mockReturnValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        mockChildren.mockReturnValueOnce(['data.json'])
        mockChildren.mockReturnValueOnce([
          'MyResource',
          'MyResource.resource-meta.xml',
        ])

        // Act
        await sut.createElement(path, staticResourceType, revision1)
        await sut.createElement(path, staticResourceType, revision2)

        // Assert - should be called 4 times (2 for each revision)
        expect(mockChildren).toHaveBeenCalledTimes(4)
        expect(mockChildren).toHaveBeenCalledWith(
          revision1,
          'force-app/main/any/path/MyResource'
        )
        expect(mockChildren).toHaveBeenCalledWith(
          revision2,
          'force-app/main/any/path/MyResource'
        )
      })
    })

    describe('When multiple metadata siblings exist at same directory level', () => {
      it('Given first sibling name not in path, When creating element, Then should skip it and find correct component', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/UpdateStaticResourceFile/resource/resource-file.txt'
        const revision = 'HEAD'
        mockFilesUnder.mockReturnValueOnce([
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
      it('Given no matching meta files, When creating element with typeDir in path, Then should fallback to last segment', async () => {
        // Arrange
        const path =
          'force-app/main/default/staticresources/unknown/nested/file.txt'
        const revision = 'HEAD'
        mockFilesUnder.mockReturnValueOnce([
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

      it('Given a revision with no built tree index, When creating element with typeDir in path, Then should fallback to last segment', async () => {
        // Arrange — degrades to empty (the reader answers [] for this
        // revision), not a throw: filesUnder is a pure trie lookup now,
        // so there is nothing left to catch.
        const path =
          'force-app/main/default/staticresources/MyResource/images/logo.png'
        mockFilesUnder.mockReturnValueOnce([])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          'UNBUILT'
        )

        // Assert - falls back to last segment
        expect(element.componentName).toBe('logo')
      })

      it('Given a revision with no built tree index, When creating element without typeDir in path, Then should fallback to last segment', async () => {
        // Arrange — same degradation, but through the directory walk-up
        // branch (children) rather than the typeDir/filesUnder one.
        const path = 'force-app/main/default/unknown/nested/file.txt'
        mockChildren.mockReturnValue([])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          'UNBUILT'
        )

        // Assert - falls back to last segment
        expect(element.componentName).toBe('file')
      })

      it('Given empty directory listings, When creating element without typeDir, Then should fallback to last segment', async () => {
        // Arrange
        const path = 'force-app/main/default/unknown/nested/file.txt'
        const revision = 'HEAD'
        mockChildren.mockReturnValue([])

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
        mockChildren.mockReturnValue(['file.txt'])

        // Act
        await sut.createElement(deepPath, staticResourceType, revision)

        // Assert - walks all 12 levels (dirname from l/ up to a/, then '.' stops)
        expect(mockChildren).toHaveBeenCalledTimes(12)
      })

      it('Given path at root directory, When creating element, Then should resolve without scan', async () => {
        // Arrange
        const path = 'file.txt'
        const revision = 'HEAD'
        mockChildren.mockReturnValue(['file.txt'])

        // Act
        const element = await sut.createElement(
          path,
          staticResourceType,
          revision
        )

        // Assert - parent dir is '.' which stops, falls back to last segment
        expect(element.componentName).toBe('file')
        expect(mockFilesUnder).not.toHaveBeenCalled()
        expect(mockChildren).not.toHaveBeenCalled()
      })
    })
  })

  // --- Mutation-killing tests ---

  describe('createElement shortcuts before scanning', () => {
    it('Given element without suffix (no-suffix type), When creating element, Then the `!metadataDef.suffix` shortcut returns the fromPath element without scanning', async () => {
      const noSuffixType: Metadata = {
        ...lwcType,
        suffix: undefined as unknown as string,
      }
      const path = 'force-app/main/default/lwc/myComponent/myComponent.js'
      const element = await sut.createElement(path, noSuffixType, 'HEAD')
      expect(element.componentName).toBe('myComponent')
      // No scan performed
      expect(mockFilesUnder).not.toHaveBeenCalled()
      expect(mockChildren).not.toHaveBeenCalled()
    })

    it('Given depth-2 path whose file carries the type suffix and matches its folder, When creating element, Then the fromPath element is returned without scanning', async () => {
      // path: .../permissionsets/Admin/Admin.permissionset-meta.xml
      // fileName = 'Admin.permissionset-meta.xml', includes '.permissionset'=true
      const path =
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml'
      const element = await sut.createElement(path, permissionSetType, 'HEAD')
      expect(element.componentName).toBe('Admin')
      // folder matches component name → fromPath used directly (no scan)
      expect(mockFilesUnder).not.toHaveBeenCalled()
      expect(mockChildren).not.toHaveBeenCalled()
    })

    it('Given depth-2 path where file suffix does NOT match type suffix, When creating element, Then returns fromPath element without scanning', async () => {
      // fileName 'Admin.txt' does not include '.permissionset' → no scan
      const path = 'force-app/main/default/permissionsets/Admin/Admin.txt'
      const element = await sut.createElement(path, permissionSetType, 'HEAD')
      expect(element.componentName).toBe('Admin')
      // A fromScan element would anchor on the file and span the full path
      expect(element.componentPath).toBe(
        'force-app/main/default/permissionsets/Admin'
      )
      expect(mockFilesUnder).not.toHaveBeenCalled()
    })

    it('Given depth-2 path whose component name differs from its folder, When creating element, Then the extracted name anchors a fromScan element', async () => {
      // pathAfterType = ['SomeFolder', 'OtherName.permissionset-meta.xml']
      // componentName extracted = 'OtherName', pathAfterType[0] = 'SomeFolder' → mismatch
      const path =
        'force-app/main/default/permissionsets/SomeFolder/OtherName.permissionset-meta.xml'
      const element = await sut.createElement(path, permissionSetType, 'HEAD')
      expect(element.componentName).toBe('OtherName')
      // The fromPath element would stop at the folder instead
      expect(element.componentPath).toBe(path)
    })
  })

  describe('scanAndCreateElement dirIndex boundary', () => {
    it('Given typeDir in path with suffix (dirIndex >= 0 && suffix), When scanning, Then filesUnder lists the type directory', async () => {
      // The `dirIndex >= 0 && suffix` false flip would walk the ancestors instead
      const path =
        'force-app/main/default/staticresources/MyResource/nested/deep.txt'
      mockFilesUnder.mockReturnValueOnce([
        'force-app/main/default/staticresources/MyResource/MyResource.resource-meta.xml',
      ])
      await sut.createElement(path, staticResourceType, 'HEAD')
      expect(mockFilesUnder).toHaveBeenCalledWith(
        'HEAD',
        'force-app/main/default/staticresources'
      )
    })

    it('Given typeDir at index 0 in path (dirIndex=0, suffix present, depth>2), When scanning, Then scanAndCreateElement still lists the type directory', async () => {
      // path: 'staticresources/MyResource/images/logo.png' → dirIndex=0 → >= 0 passes, > 0 would fail
      const path = 'staticresources/MyResource/images/logo.png'
      mockFilesUnder.mockReturnValueOnce([
        'staticresources/MyResource/MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(mockFilesUnder).toHaveBeenCalledWith('HEAD', 'staticresources')
      expect(element.componentPath).toBe('staticresources/MyResource')
    })
  })

  describe('findNameUnderTypeDirectory pathAfterType loop', () => {
    it('Given the component is the first segment after the type directory, When scanning, Then findNameUnderTypeDirectory reaches index 0 and finds it as the boundary', async () => {
      // pathAfterType = ['MyResource', 'images', 'deep.txt']: the loop checks
      // 'images' at i = 1, then 'MyResource' at i = 0; an `i > 0` bound would
      // stop before it and fall back to the file itself.
      const path =
        'force-app/main/default/staticresources/MyResource/images/deep.txt'
      mockFilesUnder.mockReturnValueOnce([
        'force-app/main/default/staticresources/MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(mockFilesUnder).toHaveBeenCalledWith(
        'HEAD',
        'force-app/main/default/staticresources'
      )
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given a listing holding the component meta file among other files, When scanning, Then the meta-file component above the file is the boundary', async () => {
      const path =
        'force-app/main/default/staticresources/MyResource/images/logo.png'
      mockFilesUnder.mockReturnValueOnce([
        'force-app/main/default/staticresources/MyResource/MyResource.resource-meta.xml',
        'force-app/main/default/staticresources/MyResource/images/logo.png',
        'force-app/main/default/staticresources/Other.txt',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given multiple components in scan result, When one matches path, Then correct component selected', async () => {
      const path =
        'force-app/main/default/staticresources/nested/MyResource/deep.txt'
      mockFilesUnder.mockReturnValueOnce([
        'force-app/main/default/staticresources/nested/MyResource/MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(element.componentPath).toBe(
        'force-app/main/default/staticresources/nested/MyResource'
      )
    })
  })

  describe('isNameInPath', () => {
    it('Given part exactly equals componentName, When isNameInPath, Then returns true', () => {
      // Mutant EqualityOperator "part !== componentName" → always false for exact match
      const resolver = new MetadataBoundaryResolver(
        getContext({ metadata: globalMetadata, trees: treeReader })
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['a', 'MyComponent', 'file.js'], 'MyComponent')
      expect(result).toBe(true)
    })

    it('Given part starts with componentName dot, When isNameInPath, Then returns true', async () => {
      // Mutant: part.endsWith(`${componentName}.`) → 'MyComponent.js'.endsWith('MyComponent.') = false → miss
      // Correct: startsWith → true
      const resolver = new MetadataBoundaryResolver(
        getContext({ metadata: globalMetadata, trees: treeReader })
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
        getContext({ metadata: globalMetadata, trees: treeReader })
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['a', 'prefix.MyComponent'], 'MyComponent')
      expect(result).toBe(false)
    })

    it('Given no part equals or starts with the component name, When isNameInPath, Then returns false', async () => {
      const resolver = new MetadataBoundaryResolver(
        getContext({ metadata: globalMetadata, trees: treeReader })
      )
      const result = (
        resolver as unknown as {
          isNameInPath: (parts: string[], name: string) => boolean
        }
      ).isNameInPath(['a', 'Other.js'], 'MyComponent')
      expect(result).toBe(false)
    })
  })

  describe('createElement depth-2 fromScan vs fromPath (mutation contrast)', () => {
    // For depth-2 paths where the suffix matches AND the folder name matches
    // the extracted component name, real returns the fromPath element
    // (no scan). Mutants on the folder-name comparison flip this: the false
    // flip, EqualityOperator and BlockStatement all force fromScan to fire —
    // verified by spying on MetadataElement.fromScan.
    it('Given depth-2 path where folder == componentName, When createElement, Then fromScan is NOT called', async () => {
      const fromScanSpy = vi.spyOn(MetadataElement, 'fromScan')
      const path =
        'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml'
      await sut.createElement(path, permissionSetType, 'HEAD')
      expect(fromScanSpy).not.toHaveBeenCalled()
    })

    it('Given depth-2 path where folder != componentName, When createElement, Then fromScan IS called with extracted name', async () => {
      // The type-suffix check's false flip and emptied block both bypass the
      //   folder-mismatch check entirely and return element via fromPath.
      // The folder-name comparison's true flip always returns element, never
      //   fromScan.
      // All three diverge from real on the mismatch path: real calls fromScan
      // with the extracted component name (here 'OtherName').
      const fromScanSpy = vi.spyOn(MetadataElement, 'fromScan')
      const path =
        'force-app/main/default/permissionsets/SomeFolder/OtherName.permissionset-meta.xml'
      await sut.createElement(path, permissionSetType, 'HEAD')
      expect(fromScanSpy).toHaveBeenCalledOnce()
      // Pin the fourth arg so extractName mutants that leave a suffix on the
      // name also die; the EqualityOperator flip never reaches fromScan and
      // dies on toHaveBeenCalledOnce.
      expect(fromScanSpy).toHaveBeenCalledWith(
        path,
        permissionSetType,
        expect.anything(),
        'OtherName'
      )
    })
  })

  describe('componentNamesUnder metaSuffix filtering (mutation contrast)', () => {
    // Both the metaSuffix `` mutant and the file.endsWith true flip cause
    // every file to feed componentNames (not just `*.${suffix}-meta.xml`).
    // Construct a scenario where a non-meta file's name matches a directory
    // segment in the path: real scan ignores it (suffix filter), mutant
    // returns it as the metadata boundary — observable on componentPath.
    it('Given non-meta file shares a name with a path segment, When scanning, Then it is ignored', async () => {
      // Depth must be > 2 to force the scanAndCreateElement branch — at
      // depth-2 the createElement shortcut returns fromPath without scanning.
      const path =
        'force-app/main/default/staticresources/wrongmatch/sub/file.bin'
      mockFilesUnder.mockReturnValueOnce([
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

  describe('findNameUnderTypeDirectory loop bounds (mutation contrast)', () => {
    it('Given typeDir at index >= 1 and a pre-dir part collides with a component name, When scanning, Then only post-typeDir parts are searched', async () => {
      // MethodExpression mutant: `parts.slice(dirIndex+1)` becomes `parts` — the loop
      // sees segments BEFORE the typeDir. We exploit that with a pre-dir
      // segment ('foo') that matches a meta-derived componentName.
      const path = 'foo/staticresources/A/B/file.bin'
      mockFilesUnder.mockReturnValueOnce([
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

    it('Given typeDir at index 0, When scanning, Then dirIndex+1 slice yields the post-type parts', async () => {
      // ArithmeticOperator mutant: `parts.slice(dirIndex+1)` becomes `parts.slice(dirIndex-1)`.
      // For dirIndex=0 the mutated slice is parts.slice(-1) (just the file)
      // and the for-loop `length - 2 = -1` skips entirely → fallback fires
      // even though a perfectly matching component is two folders up.
      const path = 'staticresources/A/B/file.bin'
      mockFilesUnder.mockReturnValueOnce([
        'staticresources/A.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      // Real: pathAfterType=['A','B','file.bin'], finds 'A' at i=0 → fromScan
      //       ('A') → componentPath='staticresources/A'.
      // Mutant: pathAfterType=['file.bin'], no iterations → fallback fromScan
      //       ('file') → componentPath = full path.
      expect(element.componentPath).toBe('staticresources/A')
    })

    it('Given last pathAfterType element matches a componentName, When scanning, Then it is excluded from the loop', async () => {
      // ArithmeticOperator mutant: loop start `length - 2` becomes `length + 2`. The
      // surplus iterations include i=length-1 (the file), so a meta file
      // sharing the file's basename is wrongly chosen as the boundary.
      const path = 'staticresources/A/B/foo.bin'
      mockFilesUnder.mockReturnValueOnce([
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

  describe('findComponentName suffix-guard (mutation contrast)', () => {
    it('Given a directory-named sibling whose name lacks the type-suffix dot-prefix, When walking, Then it is skipped', async () => {
      // The StringLiteral mutant collapses ``.${siblingMetadata.suffix}`` to ``''``,
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
      mockChildren.mockImplementation((_revision, dir) => {
        if (dir === 'parent/staticresources') {
          return ['file.bin']
        }
        if (dir === 'parent') {
          return ['staticresources', 'other']
        }
        return []
      })
      const element = await sut.createElement(path, customType, 'HEAD')
      // Real componentPath = '${typeDirectoryPath}/${componentName}'
      //   = 'parent/staticresources/file'
      // Mutant componentPath = 'parent/staticresources' (fromScan anchor=1)
      expect(element.componentPath).toBe('parent/staticresources/file')
    })
  })

  describe('componentNamesUnder given an empty listing', () => {
    it('Given a revision with no built tree index, When creating an element nested under its type directory, Then no component is found and the file itself is the boundary', async () => {
      // Arrange
      const path =
        'force-app/main/default/staticresources/MyResource/images/logo.png'
      mockFilesUnder.mockReturnValueOnce([])

      // Act
      const element = await sut.createElement(
        path,
        staticResourceType,
        'UNBUILT'
      )

      // Assert
      expect(mockFilesUnder).toHaveBeenCalledWith(
        'UNBUILT',
        'force-app/main/default/staticresources'
      )
      expect(element.componentName).toBe('logo')
      expect(element.componentPath).toBe(path)
    })
  })

  describe('siblingsOf given an empty listing', () => {
    it('Given a revision with no built tree index, When walking up from a single directory level, Then no sibling is consulted and the file itself is the boundary', async () => {
      // Arrange — a one-level path keeps the directory walk to exactly one
      // empty listing, so no sibling can reach metadataRepo.get.
      const path = 'unknownDir/file.txt'
      mockChildren.mockReturnValueOnce([])
      const getSpy = vi.spyOn(globalMetadata, 'get')

      // Act
      const element = await sut.createElement(
        path,
        staticResourceType,
        'UNBUILT'
      )

      // Assert
      expect(mockChildren).toHaveBeenCalledWith('UNBUILT', 'unknownDir')
      expect(getSpy).not.toHaveBeenCalled()
      expect(element.componentName).toBe('file')
      expect(element.pathAfterType).toEqual(['file.txt'])
    })
  })

  describe('findComponentName', () => {
    it('Given sibling with matching suffix and name in path, When findComponentName, Then returns name', async () => {
      // path through real scan
      const path = 'force-app/main/any/MyResource/images/logo.png'
      mockChildren.mockReturnValueOnce(['logo.png'])
      mockChildren.mockReturnValueOnce(['images'])
      mockChildren.mockReturnValueOnce([
        'MyResource',
        'MyResource.resource-meta.xml',
      ])
      const element = await sut.createElement(path, staticResourceType, 'HEAD')
      expect(element.pathAfterType[0]).toBe('MyResource')
    })

    it('Given sibling suffix present but name NOT in path, When findComponentName, Then skips it', async () => {
      // Mutant true: isNameInPath always returns true → first sibling taken regardless
      // Real: OtherName is not in path → skipped, MyResource found later
      const path = 'force-app/main/any/MyResource/images/logo.png'
      mockChildren.mockReturnValueOnce(['logo.png'])
      mockChildren.mockReturnValueOnce(['images'])
      mockChildren.mockReturnValueOnce([
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
