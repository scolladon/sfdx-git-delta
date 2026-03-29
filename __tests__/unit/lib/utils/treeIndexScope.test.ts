'use strict'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Metadata } from '../../../../src/types/metadata'
import { computeTreeIndexScope } from '../../../../src/utils/treeIndexScope'

vi.mock('../../../../src/utils/LoggingService')

const mockMetadata = (types: Metadata[]): MetadataRepository => {
  const byDir = new Map<string, Metadata>()
  const byExt = new Map<string, Metadata>()
  for (const t of types) {
    if (t.directoryName) byDir.set(t.directoryName, t)
    if (t.suffix) byExt.set(t.suffix, t)
  }
  return {
    has: (path: string) => byDir.has(path.split('/').find(p => byDir.has(p))!),
    get: (path: string) => {
      const parts = path.split('/')
      for (const part of parts) {
        const found = byDir.get(part)
        if (found) return found
      }
      return undefined
    },
    getFullyQualifiedName: () => '',
    values: () => types,
  }
}

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
      const customRepo: MetadataRepository = {
        has: () => true,
        get: () => ({
          directoryName: 'notInPath',
          inFolder: true,
          metaFile: false,
          xmlName: 'SomeInFolderType',
        }),
        getFullyQualifiedName: () => '',
        values: () => [
          {
            directoryName: 'notInPath',
            inFolder: true,
            metaFile: false,
            xmlName: 'SomeInFolderType',
          },
        ],
      }
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
})
