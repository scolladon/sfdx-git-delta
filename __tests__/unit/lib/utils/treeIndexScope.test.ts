'use strict'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Metadata } from '../../../../src/types/metadata'
import { computeTreeIndexScope } from '../../../../src/utils/treeIndexScope'
import {
  createMetadataRepositoryFromTypes,
  createMetadataRepositoryMock,
} from '../../../__utils__/testMetadataRepository'

vi.mock('../../../../src/utils/LoggingService')

const mockMetadata = (types: Metadata[]): MetadataRepository =>
  createMetadataRepositoryFromTypes(types)

describe('computeTreeIndexScope', () => {
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  describe('Given standard type diff lines', () => {
    it('When computed, Then returns empty set', () => {
      // Arrange
      const lines = ['A\tforce-app/main/default/classes/MyClass.cls']

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given InResource type diff lines (mixedContent adapter)', () => {
    it('When computed, Then returns type directory', () => {
      // Arrange
      const lines = ['A\tforce-app/main/default/staticresources/MyRes/file.txt']

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/staticresources')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given LWC type diff lines (bundle adapter)', () => {
    it('When computed, Then returns component directory', () => {
      // Arrange
      const lines = ['A\tforce-app/main/default/lwc/myComponent/myComponent.js']

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/lwc/myComponent')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given Aura type diff lines (bundle adapter)', () => {
    it('When computed, Then returns component directory', () => {
      // Arrange
      const lines = ['A\tforce-app/main/default/aura/myComp/myComp.cmp']

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/aura/myComp')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given CustomObject type diff lines', () => {
    it('When computed, Then returns type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/objects/Account/Account.object-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/objects')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given decomposed child type diff lines', () => {
    it('When computed, Then returns parent type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/objects/Account/fields/Name.field-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/objects')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given InFolder type diff lines (Report)', () => {
    it('When computed, Then returns type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/reports/MyFolder/MyReport.report-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/reports')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given InFolder type not in explicit set (Document)', () => {
    it('When computed, Then returns type directory via inFolder flag', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/documents/MyFolder/file.document-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/documents')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given PermissionSet decomposed diff lines', () => {
    it('When computed, Then returns type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/permissionsets/MyPS/objectPermissions/Account.objectPermission-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/permissionsets')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given multiple diff lines', () => {
    it('When computed, Then deduplicates type directories', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/classes/A.cls',
        'A\tforce-app/main/default/classes/B.cls',
        'A\tforce-app/main/default/staticresources/Res1/file.txt',
        'M\tforce-app/main/default/staticresources/Res2/file.txt',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.size).toBe(1)
      expect(sut.has('force-app/main/default/staticresources')).toBe(true)
    })
  })

  describe('Given unresolvable type', () => {
    it('When computed, Then skips it', () => {
      // Arrange
      const lines = ['A\tunknown/path/file.xyz']

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given child type with non-tree-index parent (Workflow)', () => {
    it('When computed, Then does not add to scope', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/workflows/Account.workflow-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given DigitalExperienceBundle diff lines', () => {
    it('When computed, Then returns component directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/digitalExperiences/site/MyExp/content.json',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/digitalExperiences/site')).toBe(
        true
      )
      expect(sut.size).toBe(1)
    })

    it('When computed for a canonical page content path, Then returns the base type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/digitalExperiences/site/Site_A/sfdc_cms__view/page_a/content.json',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/digitalExperiences/site')).toBe(
        true
      )
      expect(sut.size).toBe(1)
    })
  })

  describe('Given Dashboard diff lines (explicit handlerMap)', () => {
    it('When computed, Then returns type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/dashboards/MyFolder/MyDash.dashboard-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/dashboards')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given bundle type with only type directory in path', () => {
    it('When computed, Then returns type directory as fallback', () => {
      // Arrange
      const lines = ['A\tforce-app/main/default/lwc']

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/lwc')).toBe(true)
    })
  })

  describe('Given mix of tree-index and non-tree-index types', () => {
    it('When computed, Then only includes tree-index-needing types', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/classes/MyClass.cls',
        'A\tforce-app/main/default/objects/Account/Account.object-meta.xml',
        'M\tforce-app/main/default/triggers/MyTrigger.trigger',
        'A\tforce-app/main/default/lwc/myComp/myComp.js',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.size).toBe(2)
      expect(sut.has('force-app/main/default/objects')).toBe(true)
      expect(sut.has('force-app/main/default/lwc/myComp')).toBe(true)
    })
  })

  describe('Given child type whose parent is not in metadata', () => {
    it('When computed, Then does not add to scope', () => {
      // Arrange
      const child: Metadata = {
        directoryName: 'childDir',
        inFolder: false,
        metaFile: false,
        xmlName: 'OrphanChild',
        parentXmlName: 'NonExistentParent',
      }
      const repo = mockMetadata([child])
      const lines = ['A\tchildDir/file.txt']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given child type whose parent directory is not in path', () => {
    it('When computed, Then does not add to scope', () => {
      // Arrange
      const child: Metadata = {
        directoryName: 'childDir',
        inFolder: false,
        metaFile: false,
        xmlName: 'ChildType',
        parentXmlName: 'ParentType',
      }
      const parent: Metadata = {
        directoryName: 'parentDir',
        inFolder: false,
        metaFile: false,
        xmlName: 'ParentType',
        adapter: 'mixedContent',
      }
      const repo = mockMetadata([child, parent])
      const lines = ['A\tchildDir/file.txt']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given type needing tree index but directory not in path', () => {
    it('When computed, Then does not add to scope', () => {
      // Arrange
      const typeDef: Metadata = {
        directoryName: 'notInPath',
        inFolder: true,
        metaFile: false,
        xmlName: 'SomeInFolderType',
      }
      const customRepo: MetadataRepository = createMetadataRepositoryMock({
        has: () => true,
        get: () => typeDef,
        getByXmlName: () => typeDef,
        values: () => [typeDef],
      })
      const lines = ['A\tother/path/file.txt']

      // Act
      const sut = computeTreeIndexScope(lines, customRepo)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given metadata with entries lacking xmlName', () => {
    it('When computed, Then skips entries without xmlName in parent index', () => {
      // Arrange
      const typeWithoutXmlName: Metadata = {
        directoryName: 'noName',
        inFolder: false,
        metaFile: false,
      }
      const typeWithXmlName: Metadata = {
        directoryName: 'myTypes',
        inFolder: false,
        metaFile: false,
        xmlName: 'CustomObject',
      }
      const repo = mockMetadata([typeWithoutXmlName, typeWithXmlName])
      const lines = ['A\tmyTypes/Account/Account.object-meta.xml']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('myTypes')).toBe(true)
    })
  })

  describe('Given empty lines array', () => {
    it('When computed, Then returns empty set', () => {
      // Arrange
      const lines: string[] = []

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given GenAiFunction diff lines', () => {
    it('When computed, Then returns component directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/genAiFunctions/MyFunc/MyFunc.genAiFunction-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/genAiFunctions/MyFunc')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given Territory2Model diff lines', () => {
    it('When computed, Then returns type directory', () => {
      // Arrange
      const lines = [
        'A\tforce-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, metadata)

      // Assert
      expect(sut.has('force-app/main/default/territory2Models')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given type with inFolder=true but not in TREE_INDEX_XML_NAMES and not bundle/mixedContent', () => {
    it('When computed, Then still returns type directory via inFolder flag', () => {
      // Arrange
      const inFolderType: Metadata = {
        directoryName: 'emailTemplates',
        inFolder: true,
        metaFile: false,
        xmlName: 'EmailTemplate',
      }
      const repo = mockMetadata([inFolderType])
      const lines = [
        'A\tforce-app/main/default/emailTemplates/MyFolder/tpl.email',
      ]

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('force-app/main/default/emailTemplates')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given metadata entry without xmlName in parent index', () => {
    it('When child references a parent, Then only entries with xmlName are findable', () => {
      // Arrange
      const parentWithoutXmlName: Metadata = {
        directoryName: 'parentDir',
        inFolder: true,
        metaFile: false,
      }
      const child: Metadata = {
        directoryName: 'childDir',
        inFolder: false,
        metaFile: false,
        xmlName: 'ChildType',
        parentXmlName: 'MissingXmlParent',
      }
      const repo = mockMetadata([parentWithoutXmlName, child])
      const lines = ['A\tchildDir/file.txt']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given bundle type where directory is the last path segment', () => {
    it('When computed, Then returns fallback to directory without component name', () => {
      // Arrange
      const bundleType: Metadata = {
        directoryName: 'aura',
        inFolder: false,
        metaFile: false,
        xmlName: 'AuraDefinitionBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      const lines = ['A\tforce-app/main/default/aura']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('force-app/main/default/aura')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given bundle type with component name in path', () => {
    it('When computed, Then returns path including component directory', () => {
      // Arrange
      const bundleType: Metadata = {
        directoryName: 'aura',
        inFolder: false,
        metaFile: false,
        xmlName: 'AuraDefinitionBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      const lines = ['A\tforce-app/main/default/aura/myComp/myComp.cmp']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('force-app/main/default/aura/myComp')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given each TREE_INDEX_XML_NAMES entry', () => {
    it.each([
      {
        xmlName: 'CustomObject',
        directoryName: 'objects',
        path: 'force-app/main/default/objects/Account/Account.object-meta.xml',
        expected: 'force-app/main/default/objects',
      },
      {
        xmlName: 'Dashboard',
        directoryName: 'dashboards',
        path: 'force-app/main/default/dashboards/MyDash/Dash.dashboard-meta.xml',
        expected: 'force-app/main/default/dashboards',
      },
      {
        xmlName: 'Report',
        directoryName: 'reports',
        path: 'force-app/main/default/reports/MyFolder/Report.report-meta.xml',
        expected: 'force-app/main/default/reports',
      },
      {
        xmlName: 'AuraDefinitionBundle',
        directoryName: 'aura',
        adapter: 'bundle',
        path: 'force-app/main/default/aura/myComp/myComp.cmp',
        expected: 'force-app/main/default/aura/myComp',
      },
      {
        xmlName: 'LightningComponentBundle',
        directoryName: 'lwc',
        adapter: 'bundle',
        path: 'force-app/main/default/lwc/myComp/myComp.js',
        expected: 'force-app/main/default/lwc/myComp',
      },
      {
        xmlName: 'GenAiFunction',
        directoryName: 'genAiFunctions',
        adapter: 'bundle',
        path: 'force-app/main/default/genAiFunctions/MyFunc/MyFunc.genAiFunction-meta.xml',
        expected: 'force-app/main/default/genAiFunctions/MyFunc',
      },
      {
        xmlName: 'PermissionSet',
        directoryName: 'permissionsets',
        path: 'force-app/main/default/permissionsets/MyPS/MyPS.permissionset-meta.xml',
        expected: 'force-app/main/default/permissionsets',
      },
      {
        xmlName: 'Territory2Model',
        directoryName: 'territory2Models',
        path: 'force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
        expected: 'force-app/main/default/territory2Models',
      },
    ])('When $xmlName diff line is computed, Then returns correct scope', ({
      xmlName,
      directoryName,
      adapter,
      path,
      expected,
    }) => {
      // Arrange
      const type: Metadata = {
        directoryName,
        inFolder: false,
        metaFile: false,
        xmlName,
        ...(adapter ? { adapter } : {}),
      }
      const repo = mockMetadata([type])
      const lines = [`A\t${path}`]

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has(expected)).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given bundle type where dirIndex + 1 equals parts.length', () => {
    it('When computed, Then returns path up to directory without extra segment', () => {
      // Arrange
      const bundleType: Metadata = {
        directoryName: 'lwc',
        inFolder: false,
        metaFile: false,
        xmlName: 'LightningComponentBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      const lines = ['A\tforce-app/main/default/lwc']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('force-app/main/default/lwc')).toBe(true)
      expect(sut.size).toBe(1)
    })

    it('When path has component after directory, Then includes component in scope', () => {
      // Arrange
      const bundleType: Metadata = {
        directoryName: 'lwc',
        inFolder: false,
        metaFile: false,
        xmlName: 'LightningComponentBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      const lines = ['A\tforce-app/main/default/lwc/myComp/myComp.js']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      const expected = 'force-app/main/default/lwc/myComp'
      expect(sut.has(expected)).toBe(true)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given bundle type at exactly dirIndex + 1 == parts.length (boundary: only dir segment, no component after)', () => {
    it('When path equals exactly the directoryName segment, Then returns the directory path without going past it', () => {
      // Arrange — path has exactly one segment after the base prefix: the
      // directoryName itself. dirIndex + 1 == parts.length so the < branch
      // is false; we must take the else branch (slice to dirIndex + 1).
      const bundleType: Metadata = {
        directoryName: 'aura',
        inFolder: false,
        metaFile: false,
        xmlName: 'AuraDefinitionBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      // Only the dir segment present — dirIndex is the last index.
      const lines = ['A\taura']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert — must equal 'aura', not 'aura/<undefined>'
      expect(sut.has('aura')).toBe(true)
      expect(sut.size).toBe(1)
    })

    it('When path has one segment after the dir (component), Then includes exactly dir + component', () => {
      // Arrange — dirIndex + 1 < parts.length, so the < branch is taken.
      // We get dir + 2 segments => dir/component
      const bundleType: Metadata = {
        directoryName: 'aura',
        inFolder: false,
        metaFile: false,
        xmlName: 'AuraDefinitionBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      const lines = ['A\taura/myComp']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('aura/myComp')).toBe(true)
      expect(sut.size).toBe(1)
    })

    it('When path has multiple segments after the dir, Then still returns dir + component (not deeper)', () => {
      // Arrange — only first two segments from dirIndex matter; deeper files
      // must not extend the scope.
      const bundleType: Metadata = {
        directoryName: 'aura',
        inFolder: false,
        metaFile: false,
        xmlName: 'AuraDefinitionBundle',
        adapter: 'bundle',
      }
      const repo = mockMetadata([bundleType])
      const lines = ['A\taura/myComp/helper.js']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert — scope must be 'aura/myComp', not 'aura/myComp/helper.js'
      expect(sut.has('aura/myComp')).toBe(true)
      expect(sut.has('aura/myComp/helper.js')).toBe(false)
      expect(sut.size).toBe(1)
    })
  })

  describe('Given a path whose directoryName segment is absent (dirIndex < 0)', () => {
    it('When computed for non-bundle type, Then scopeForType returns null and no scope added', () => {
      // Arrange — type.directoryName = 'objects' but path contains 'classes'
      // so indexOf returns -1. The `dirIndex < 0 → return null` branch fires.
      const typeDef: Metadata = {
        directoryName: 'objects',
        inFolder: false,
        metaFile: false,
        xmlName: 'CustomObject',
      }
      const repo = mockMetadata([typeDef])
      const customRepo = createMetadataRepositoryMock({
        has: () => true,
        get: () => typeDef,
        getByXmlName: () => typeDef,
        values: () => [typeDef],
      })
      const lines = ['A\tclasses/MyClass.cls']

      // Act
      const sut = computeTreeIndexScope(lines, customRepo)

      // Assert
      expect(sut.size).toBe(0)
    })
  })

  describe('Given BUNDLE_ADAPTERS set membership', () => {
    it.each([
      'bundle',
      'digitalExperience',
    ])('When adapter is %s, Then component directory is included in scope', adapter => {
      // Arrange
      const bundleType: Metadata = {
        directoryName: 'mydir',
        inFolder: false,
        metaFile: false,
        xmlName: 'SomeBundleType',
        adapter,
      }
      const repo = mockMetadata([bundleType])
      const lines = [`A\tmydir/myComp/file.js`]

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('mydir/myComp')).toBe(true)
    })

    it('When adapter is mixedContent, Then type directory (not component dir) is included', () => {
      // Arrange — mixedContent is NOT in BUNDLE_ADAPTERS so takes the
      // non-bundle branch → slice to dirIndex + 1
      const mixedType: Metadata = {
        directoryName: 'staticresources',
        inFolder: false,
        metaFile: false,
        xmlName: 'StaticResource',
        adapter: 'mixedContent',
      }
      const repo = mockMetadata([mixedType])
      const lines = ['A\tstaticresources/MyRes/file.txt']

      // Act
      const sut = computeTreeIndexScope(lines, repo)

      // Assert
      expect(sut.has('staticresources')).toBe(true)
      expect(sut.size).toBe(1)
    })
  })
})
