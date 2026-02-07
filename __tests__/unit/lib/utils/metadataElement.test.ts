'use strict'
import { beforeAll, describe, expect, it } from '@jest/globals'

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

    it('Given static resource folder path, When fromPath, Then returns file-based component name and correct componentBasePath', () => {
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
      expect(element!.componentBasePath).toBe(
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
      expect(element!.componentBasePath).toBe(
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
      expect(element.componentBasePath).toBe('force-app/main/any/path/MyAsset')
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
    it('Given static resource single file (not folder), When fromPath, Then componentBasePath includes directory', () => {
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
})
