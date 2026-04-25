'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { MetadataElement } from '../../../../src/utils/metadataElement'

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

const apexClassType = {
  directoryName: 'classes',
  inFolder: false,
  metaFile: true,
  suffix: 'cls',
  xmlName: 'ApexClass',
}

const staticResourceType = {
  directoryName: 'staticresources',
  inFolder: false,
  metaFile: true,
  suffix: 'resource',
  xmlName: 'StaticResource',
}

const lwcType = {
  directoryName: 'lwc',
  inFolder: false,
  metaFile: false,
  suffix: '',
  xmlName: 'LightningComponentBundle',
}

const recordTypeType = {
  directoryName: 'recordTypes',
  inFolder: false,
  metaFile: false,
  suffix: 'recordType',
  parentXmlName: 'CustomObject',
  xmlName: 'RecordType',
}

const documentType = {
  directoryName: 'documents',
  inFolder: true,
  metaFile: true,
  suffix: 'document',
  xmlName: 'Document',
}

const experienceBundleType = {
  directoryName: 'experiences',
  inFolder: false,
  metaFile: true,
  suffix: 'site',
  xmlName: 'ExperienceBundle',
}

describe('MetadataElement', () => {
  describe('fromPath', () => {
    it('Given ApexClass path, When fromPath, Then returns element with correct properties', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'

      // Act
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.fullPath).toBe(path)
      expect(element!.basePath).toBe(path)
      expect(element!.isMetaFile).toBe(false)
      expect(element!.extension).toBe('cls')
      expect(element!.componentName).toBe('MyClass')
      expect(element!.parentFolder).toBe('classes')
    })

    it('Given ApexClass meta file path, When fromPath, Then strips meta suffix from basePath', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.fullPath).toBe(path)
      expect(element!.basePath).toBe(
        'force-app/main/default/classes/MyClass.cls'
      )
      expect(element!.isMetaFile).toBe(true)
      expect(element!.componentName).toBe('MyClass')
    })

    it('Given LWC component file, When fromPath, Then returns file-based component name', () => {
      // Arrange
      const path = 'force-app/main/default/lwc/myComponent/myComponent.js'

      // Act
      const element = MetadataElement.fromPath(path, lwcType, globalMetadata)

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('myComponent')
      expect(element!.parentFolder).toBe('myComponent')
      expect(element!.typeDirectoryPath).toBe('force-app/main/default/lwc')
      expect(element!.pathAfterType).toEqual(['myComponent', 'myComponent.js'])
    })

    it('Given nested LWC path with duplicate directoryName, When fromPath, Then uses lastIndexOf', () => {
      // Arrange
      const path =
        'force-app/main/default/lwc/sub_folder1/lwc/deeplyNestedComponent/deeplyNestedComponent.js'

      // Act
      const element = MetadataElement.fromPath(path, lwcType, globalMetadata)

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('deeplyNestedComponent')
    })

    it('Given static resource folder path, When fromPath, Then returns file-based component name and correct componentPath', () => {
      // Arrange
      const path =
        'force-app/main/default/staticresources/MyResource/images/logo.png'

      // Act
      const element = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('logo')
      expect(element!.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
      expect(element!.pathAfterType[0]).toBe('MyResource')
    })

    it('Given static resource file path, When fromPath, Then returns correct component name', () => {
      // Arrange
      const path =
        'force-app/main/default/staticresources/MyResource.resource-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('MyResource')
    })

    it('Given decomposed child path (recordType), When fromPath, Then returns correct parent and component names', () => {
      // Arrange
      const path =
        'force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        recordTypeType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('Test')
      expect(element!.parentName).toBe('Account')
      expect(element!.typeDirectoryPath).toBe(
        'force-app/main/default/objects/Account/recordTypes'
      )
    })

    it('Given in-folder document path, When fromPath, Then returns correct path after type', () => {
      // Arrange
      const path =
        'force-app/main/default/documents/folder/test.document-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        documentType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.pathAfterType).toEqual([
        'folder',
        'test.document-meta.xml',
      ])
      expect(element!.componentName).toBe('test')
    })

    it('Given experience bundle nested path, When fromPath, Then returns correct component name', () => {
      // Arrange
      const path =
        'force-app/main/default/experiences/my_bundle/config/file.json'

      // Act
      const element = MetadataElement.fromPath(
        path,
        experienceBundleType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('file')
      expect(element!.componentPath).toBe(
        'force-app/main/default/experiences/my_bundle'
      )
      expect(element!.pathAfterType[0]).toBe('my_bundle')
    })

    it('Given path without directoryName, When fromPath, Then returns null', () => {
      // Arrange
      const path = 'force-app/main/any/path/here/MyAsset/images/logo.png'

      // Act
      const element = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )

      // Assert
      expect(element).toBeNull()
    })
  })

  describe('fromScan', () => {
    it('Given component name matching a folder, When fromScan, Then resolves anchor from name', () => {
      // Arrange
      const path = 'force-app/main/any/path/MyAsset/images/logo.png'

      // Act
      const element = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'MyAsset'
      )

      // Assert
      expect(element.componentName).toBe('logo')
      expect(element.componentPath).toBe('force-app/main/any/path/MyAsset')
      expect(element.pathAfterType[0]).toBe('MyAsset')
    })

    it('Given component name matching a file with suffix, When fromScan, Then resolves anchor from prefix match', () => {
      // Arrange
      const path = 'force-app/main/any/path/MyResource.resource-meta.xml'

      // Act
      const element = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'MyResource'
      )

      // Assert
      expect(element.componentName).toBe('MyResource')
    })

    it('Given component name not in path, When fromScan, Then falls back to last segment', () => {
      // Arrange
      const path = 'force-app/main/any/path/file.txt'

      // Act
      const element = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'NonExistent'
      )

      // Assert
      expect(element.componentName).toBe('file')
    })

    it('Given path without directoryName and anchorIndex >= 2, When accessing parentName, Then returns parent before anchor directory', () => {
      // Arrange
      const path = 'force-app/main/any/path/MyAsset/images/logo.png'

      // Act
      const element = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'MyAsset'
      )

      // Assert
      // anchorIndex = 4 (MyAsset), parts[4-2] = parts[2] = 'any'
      expect(element.parentName).toBe('any')
    })

    it('Given short path without directoryName and anchorIndex < 2, When accessing parentName, Then returns empty string', () => {
      // Arrange
      const path = 'a/MyComponent.js'

      // Act
      const element = MetadataElement.fromScan(
        path,
        lwcType,
        globalMetadata,
        'MyComponent'
      )

      // Assert
      // anchorIndex = 1 (MyComponent.js starts with 'MyComponent.'), which is < 2
      expect(element.parentName).toBe('')
    })

    it('Given path without directoryName, When accessing typeDirectoryPath, Then returns path up to anchor', () => {
      // Arrange
      const path = 'force-app/main/any/path/MyAsset/images/logo.png'

      // Act
      const element = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'MyAsset'
      )

      // Assert
      // anchorIndex = 4 (MyAsset), slice(0, 4) = ['force-app', 'main', 'any', 'path']
      expect(element.typeDirectoryPath).toBe('force-app/main/any/path')
    })
  })

  describe('type', () => {
    it('Given element, When accessing type, Then returns metadata definition', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )!

      // Act & Assert
      expect(element.type).toBe(apexClassType)
      expect(element.type.xmlName).toBe('ApexClass')
      expect(element.type.suffix).toBe('cls')
    })
  })

  describe('getParentType', () => {
    it('Given decomposed type with parentXmlName, When getParentType, Then returns parent metadata', () => {
      // Arrange
      const path =
        'force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml'
      const element = MetadataElement.fromPath(
        path,
        recordTypeType,
        globalMetadata
      )!

      // Act
      const parentType = element.getParentType()

      // Assert
      expect(parentType).toBeDefined()
      expect(parentType!.xmlName).toBe('CustomObject')
    })

    it('Given standard type without parentXmlName, When getParentType, Then returns undefined', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )!

      // Act
      const parentType = element.getParentType()

      // Assert
      expect(parentType).toBeUndefined()
    })
  })

  describe('parts', () => {
    it('Given path, When accessing parts, Then returns readonly array of path segments', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )!

      // Act & Assert
      expect(element.parts).toEqual([
        'force-app',
        'main',
        'default',
        'classes',
        'MyClass.cls',
      ])
    })
  })

  describe('basePath handling', () => {
    it('Given metaFile=true type with -meta.xml path, When fromPath, Then basePath strips -meta.xml', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.basePath).toBe(
        'force-app/main/default/classes/MyClass.cls'
      )
      expect(element!.fullPath).toBe(path)
    })

    it('Given metaFile=false type with -meta.xml path, When fromPath, Then basePath keeps -meta.xml', () => {
      // Arrange
      const testSuiteType = {
        directoryName: 'testSuites',
        inFolder: false,
        metaFile: false,
        suffix: 'testSuite',
        xmlName: 'ApexTestSuite',
      }
      const path = 'force-app/main/default/testSuites/suite.testSuite-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        testSuiteType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.basePath).toBe(path)
      expect(element!.fullPath).toBe(path)
      expect(element!.extension).toBe('testSuite')
    })
  })

  describe('edge cases', () => {
    it('Given static resource single file, When fromPath, Then componentPath returns component boundary', () => {
      // Arrange
      const path = 'force-app/main/default/staticresources/MyResource.png'

      // Act
      const element = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentName).toBe('MyResource')
      expect(element!.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given static resource meta file (single-file resource), When fromPath, Then componentPath returns component boundary', () => {
      // Arrange
      const path =
        'force-app/main/default/staticresources/MyResource.resource-meta.xml'

      // Act
      const element = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given file with dots in name, When fromPath, Then extracts correct extension', () => {
      // Arrange
      const path = 'force-app/main/default/classes/My.Namespace.Class.cls'

      // Act
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )

      // Assert
      expect(element).not.toBeNull()
      expect(element!.extension).toBe('cls')
    })
  })

  describe('getSharedFolderMetadata', () => {
    it('Given element, When getSharedFolderMetadata, Then returns a Map', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )!

      // Act
      const result = element.getSharedFolderMetadata()

      // Assert
      expect(result).toBeInstanceOf(Map)
    })
  })

  describe('getInFileAttributes', () => {
    it('Given element, When getInFileAttributes, Then returns a Map', () => {
      // Arrange
      const path = 'force-app/main/default/classes/MyClass.cls'
      const element = MetadataElement.fromPath(
        path,
        apexClassType,
        globalMetadata
      )!

      // Act
      const result = element.getInFileAttributes()

      // Assert
      expect(result).toBeInstanceOf(Map)
    })
  })

  // --- Mutation-killing tests ---

  describe('fromScan anchorIndex boundary (L74)', () => {
    it('Given componentName at index 0, When fromScan, Then anchorIndex is 0 not parts.length-1', () => {
      // exactIndex = 0, which is >= 0 → anchorIndex = 0
      // Mutant "anchorIndex > 0" would make this fall through to parts.length-1
      const path = 'MyComponent/sub/file.txt'
      const sut = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'MyComponent'
      )
      // pathAfterType should start with 'MyComponent', proving anchorIndex = 0
      expect(sut.pathAfterType[0]).toBe('MyComponent')
    })

    it('Given componentName not in path, When fromScan, Then falls back to parts.length-1', () => {
      // anchorIndex = -1 → fallback to parts.length - 1 = 2 (index of 'file.txt')
      // Mutant "parts.length + 1" would cause out-of-bounds
      const path = 'a/b/file.txt'
      const sut = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'NonExistent'
      )
      expect(sut.componentName).toBe('file')
    })
  })

  describe('findComponentIndex boundaries (L83, L86, L87, L91)', () => {
    it('Given componentName matches exactly at index 0, When fromScan, Then exact match takes priority', () => {
      // exactIndex = 0 >= 0 → returns immediately
      // Mutant "exactIndex > 0" would skip this and enter loop
      const path = 'MyComponent/file.cls'
      const sut = MetadataElement.fromScan(
        path,
        apexClassType,
        globalMetadata,
        'MyComponent'
      )
      expect(sut.pathAfterType[0]).toBe('MyComponent')
    })

    it('Given componentName matches via startsWith at index 0, When fromScan, Then dot-prefixed match is found', () => {
      // No exact match (parts = ['MyClass.cls']), loop i=0 >= 0 → startsWith('MyClass.') = true → returns 0
      // Mutant "i >= 0" → "i > 0" would skip i=0
      const path = 'MyClass.cls'
      const sut = MetadataElement.fromScan(
        path,
        apexClassType,
        globalMetadata,
        'MyClass'
      )
      expect(sut.componentName).toBe('MyClass')
    })

    it('Given file matching componentName with dot suffix, When fromScan, Then startsWith used not endsWith', () => {
      // 'MyClass.cls'.startsWith('MyClass.') = true → found
      // Mutant endsWith('MyClass.') = false → would miss and return -1
      const path = 'force-app/classes/MyClass.cls'
      const sut = MetadataElement.fromScan(
        path,
        apexClassType,
        globalMetadata,
        'MyClass'
      )
      expect(sut.componentName).toBe('MyClass')
    })

    it('Given componentName part.endsWith dot (not startsWith), When fromScan, Then no match via loop', () => {
      // 'suffix.MyClass' does not startsWith 'MyClass.' → loop misses → returns -1 → fallback
      const path = 'force-app/classes/suffix.MyClass'
      const sut = MetadataElement.fromScan(
        path,
        apexClassType,
        globalMetadata,
        'MyClass'
      )
      // Falls back to parts.length-1 = index 2 → 'suffix.MyClass'
      expect(sut.componentName).toBe('suffix')
    })
  })

  describe('fromPath isFolder boundary (L52, L56)', () => {
    it('Given dirIndex = 0 (directory at first segment), When fromPath, Then returns non-null element', () => {
      // dirIndex = 0, which is >= 0 (not < 0) so no null return
      // Mutant "dirIndex <= 0" would return null here
      const path = 'classes/MyClass.cls'
      const sut = MetadataElement.fromPath(path, apexClassType, globalMetadata)
      expect(sut).not.toBeNull()
      expect(sut!.componentName).toBe('MyClass')
    })

    it('Given file directly in type dir (not folder), When fromPath, Then isFolder is false (anchorIndex = dirIndex)', () => {
      // dirIndex+1 = 4, parts.length-1 = 4 → 4 < 4 is false → isFolder=false → anchorIndex=dirIndex
      // Mutant "dirIndex + 1 <= parts.length - 1" same as "dirIndex+1 < parts.length" but on boundary
      const path = 'force-app/main/default/classes/MyClass.cls'
      const sut = MetadataElement.fromPath(path, apexClassType, globalMetadata)!
      // pathAfterType = ['MyClass.cls'] → length 1
      expect(sut.pathAfterType).toHaveLength(1)
    })

    it('Given file one level deep in type dir (folder type), When fromPath, Then isFolder is true (anchorIndex = dirIndex+1)', () => {
      // path: .../staticresources/MyResource/logo.png
      // dirIndex+1 = 4, parts.length-1 = 5 → 4 < 5 = true → isFolder → anchorIndex = dirIndex+1
      // Mutant "dirIndex - 1" would give wrong anchorIndex
      const path = 'force-app/main/default/staticresources/MyResource/logo.png'
      const sut = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )!
      // componentPath should reflect anchor at 'MyResource'
      expect(sut.componentPath).toBe(
        'force-app/main/default/staticresources/MyResource'
      )
    })

    it('Given isFolder boundary at exactly parts.length-1 position, When fromPath with ArithOp mutation, Then correct behavior', () => {
      // Mutant "parts.length + 1" would flip isFolder incorrectly
      // dirIndex+1 exactly equals parts.length-1 means only one file in dir (not folder)
      const path = 'force-app/main/default/staticresources/MyResource.resource'
      const sut = MetadataElement.fromPath(
        path,
        staticResourceType,
        globalMetadata
      )!
      // one part after type dir → not folder → pathAfterType.length = 1
      expect(sut.pathAfterType).toHaveLength(1)
    })
  })

  describe('parentName getter boundaries (L104, L108)', () => {
    it('Given dirIndex = 1, When parentName accessed, Then returns parts[0]', () => {
      // dirIndex >= 1 → return parts[dirIndex - 1] = parts[0]
      // Mutant "dirIndex > 1" would skip this and go to anchorIndex branch
      const path = 'parent/classes/MyClass.cls'
      const sut = MetadataElement.fromPath(path, apexClassType, globalMetadata)!
      expect(sut.parentName).toBe('parent')
    })

    it('Given dirIndex = 0, anchorIndex >= 2, When parentName accessed via fromScan fallback, Then returns parts[anchorIndex-2]', () => {
      // fromPath: dirIndex=0 < 1 → skip first branch
      // anchorIndex = dirIndex = 0 < 2 → skip second → return ''
      const path = 'classes/MyClass.cls'
      const sut = MetadataElement.fromPath(path, apexClassType, globalMetadata)!
      expect(sut.parentName).toBe('')
    })

    it('Given scan element with anchorIndex = 2, When parentName accessed, Then returns parts[0]', () => {
      // fromScan: anchorIndex = 2 >= 2 → return parts[2-2] = parts[0]
      // Mutant "anchorIndex > 2" would skip → ''
      const path = 'a/b/MyComponent/file.js'
      const sut = MetadataElement.fromScan(
        path,
        lwcType,
        globalMetadata,
        'MyComponent'
      )
      // anchorIndex = 2 (exactMatch at index 2)
      expect(sut.parentName).toBe('a')
    })
  })

  describe('typeDirectoryPath getter (L123, L125)', () => {
    it('Given dirIndex = 0, When typeDirectoryPath accessed, Then returns single segment', () => {
      // dirIndex = 0 >= 0 → slice(0, 0+1) = ['classes'] → 'classes'
      // Mutant "dirIndex > 0" would skip to fallback
      const path = 'classes/MyClass.cls'
      const sut = MetadataElement.fromPath(path, apexClassType, globalMetadata)!
      expect(sut.typeDirectoryPath).toBe('classes')
    })
  })

  describe('pathAfterType getter (L132)', () => {
    it('Given dirIndex = 0, When pathAfterType accessed, Then returns parts after index 0', () => {
      // dirIndex = 0 >= 0 → slice(0+1) = parts after 'classes'
      // Mutant "dirIndex > 0" would skip to fallback
      const path = 'classes/MyClass.cls'
      const sut = MetadataElement.fromPath(path, apexClassType, globalMetadata)!
      expect(sut.pathAfterType).toEqual(['MyClass.cls'])
    })
  })

  describe('findComponentIndex startsWith vs endsWith (L87) — anchor < parts.length-1', () => {
    it('Given componentName file at non-last position, When fromScan, Then startsWith match returns correct anchor index', () => {
      // path: 'MyClass.cls/sub' — parts = ['MyClass.cls', 'sub']
      // No exact match for 'MyClass'. Loop i=1: 'sub'.startsWith('MyClass.') = false.
      // i=0: 'MyClass.cls'.startsWith('MyClass.') = true → returns 0.
      // With endsWith mutant: 'sub'.endsWith('MyClass.') = false, 'MyClass.cls'.endsWith('MyClass.') = false
      //   → returns -1 → fallback to parts.length-1 = 1.
      // anchorIndex=0 gives pathAfterType=['MyClass.cls','sub'], pathAfterType[0]='MyClass.cls'
      // anchorIndex=1 gives pathAfterType=['sub'],               pathAfterType[0]='sub'
      const path = 'MyClass.cls/sub'
      const sut = MetadataElement.fromScan(
        path,
        apexClassType,
        globalMetadata,
        'MyClass'
      )
      expect(sut.pathAfterType[0]).toBe('MyClass.cls')
    })

    it('Given componentName suffix match at index 0 of multi-part path, When fromScan, Then typeDirectoryPath is empty (anchor at 0)', () => {
      // Similarly kills the `i > 0` loop-boundary mutant:
      // loop descends from i=1 to i=0. If loop used `i > 0`, it would skip i=0.
      // path: 'MyClass.cls/sub', anchorIndex=0 → typeDirectoryPath = parts.slice(0,0).join = ''
      const path = 'MyClass.cls/sub'
      const sut = MetadataElement.fromScan(
        path,
        apexClassType,
        globalMetadata,
        'MyClass'
      )
      // slice(0, 0) joins to '' — typeDirectoryPath fallback returns ''
      expect(sut.typeDirectoryPath).toBe('')
    })
  })

  describe('fromScan fallback anchorIndex arithmetic (L74 parts.length-1 vs +1)', () => {
    it('Given no componentName match, When fromScan, Then typeDirectoryPath uses parts.length-1 anchor correctly', () => {
      // path: 'a/b/file.txt' → parts = ['a','b','file.txt'], length=3
      // anchorIndex = -1 → fallback = parts.length-1 = 2
      // typeDirectoryPath: dirIndex=-1 < 0 → fallback = parts.slice(0, anchorIndex=2).join = 'a/b'
      // With parts.length+1=4: anchorIndex=4 > parts.length → slice(0,4) = ['a','b','file.txt'] → 'a/b/file.txt'
      const path = 'a/b/file.txt'
      const sut = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'NonExistent'
      )
      expect(sut.typeDirectoryPath).toBe('a/b')
    })

    it('Given anchorIndex exactly -1, When fromScan, Then pathAfterType contains only last segment', () => {
      // anchorIndex=-1 → fallback 2 → pathAfterType = parts.slice(2) = ['file.txt']
      // With parts.length+1=4 → parts.slice(4) = [] → pathAfterType is empty
      const path = 'a/b/file.txt'
      const sut = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'NonExistent'
      )
      expect(sut.pathAfterType).toHaveLength(1)
      expect(sut.pathAfterType[0]).toBe('file.txt')
    })
  })

  describe('findComponentIndex returns -1 (L91 UnaryOperator +1)', () => {
    it('Given no match in path, When fromScan, Then fallback to last segment (not index 1)', () => {
      // findComponentIndex returns -1. Mutant +1 changes return to +1.
      // With -1: anchorIndex = parts.length-1 = 3 → pathAfterType[0] = 'not-a-component.txt'
      // With +1: anchorIndex = 1 → pathAfterType[0] = parts[1] = 'b'
      const path = 'a/b/c/not-a-component.txt'
      const sut = MetadataElement.fromScan(
        path,
        staticResourceType,
        globalMetadata,
        'NonExistent'
      )
      // anchorIndex should be parts.length-1=3, so pathAfterType starts at index 3
      expect(sut.pathAfterType).toHaveLength(1)
      expect(sut.pathAfterType[0]).toBe('not-a-component.txt')
    })
  })

  describe('findComponentIndex exactIndex >= 0 (L83 ConditionalExpression true)', () => {
    it('Given exact match returns 0, When anchorIndex=0, Then pathAfterType contains all parts from index 0', () => {
      // exactIndex=0 >= 0 → returns 0 immediately. Mutant `true` always returns exactIndex.
      // But mutant `true` still returns exactIndex=0, so same result.
      // Mutant L83 ConditionalExpression false: skips return, enters loop.
      // Loop: i=1: parts[1].startsWith('MyComponent.') = false → i=0: parts[0]='MyComponent'.startsWith='MyComponent.')=false → returns -1
      // anchorIndex=-1 → fallback to parts.length-1=1
      // pathAfterType: anchorIndex=0 → ['MyComponent','sub'], anchorIndex=1 → ['sub']
      const path = 'MyComponent/sub'
      const sut = MetadataElement.fromScan(
        path,
        lwcType,
        globalMetadata,
        'MyComponent'
      )
      expect(sut.pathAfterType[0]).toBe('MyComponent')
      expect(sut.pathAfterType).toHaveLength(2)
    })
  })
})
