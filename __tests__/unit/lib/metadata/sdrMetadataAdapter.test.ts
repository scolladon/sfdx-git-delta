'use strict'
import { beforeEach, describe, expect, it, jest } from '@jest/globals'

import { SDRMetadataAdapter } from '../../../../src/metadata/sdrMetadataAdapter'

// Mock registry type for testing
type MockRegistry = {
  types: Record<string, unknown>
}

describe('SDRMetadataAdapter', () => {
  beforeEach(() => {
    SDRMetadataAdapter.clearCache()
  })

  describe('getLatestApiVersion', () => {
    it('Given SDR returns version number, When getting latest version, Then returns version as string', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@salesforce/source-deploy-retrieve', () => ({
        getCurrentApiVersion: jest
          .fn<() => Promise<number>>()
          .mockResolvedValue(62),
        registry: { types: {} },
      }))
      const { SDRMetadataAdapter: MockedAdapter } = await import(
        '../../../../src/metadata/sdrMetadataAdapter'
      )

      // Act
      const version = await MockedAdapter.getLatestApiVersion()

      // Assert
      expect(version).toBe('62')
    })
  })

  describe('toInternalMetadata', () => {
    describe('basic type conversion', () => {
      it('Given SDR type with all properties, When converting, Then maps to internal Metadata format', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            apexclass: {
              id: 'apexclass',
              name: 'ApexClass',
              directoryName: 'classes',
              inFolder: false,
              suffix: 'cls',
              strategies: { adapter: 'default' },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const apexClass = metadata.find(m => m.xmlName === 'ApexClass')
        expect(apexClass).toEqual({
          directoryName: 'classes',
          inFolder: false,
          metaFile: false,
          suffix: 'cls',
          xmlName: 'ApexClass',
        })
      })

      it('Given SDR type with bundle adapter, When converting, Then metaFile is true', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            lightningcomponentbundle: {
              id: 'lightningcomponentbundle',
              name: 'LightningComponentBundle',
              directoryName: 'lwc',
              suffix: 'js',
              strategies: { adapter: 'bundle' },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const lwc = metadata.find(m => m.xmlName === 'LightningComponentBundle')
        expect(lwc?.metaFile).toBe(true)
      })

      it('Given SDR type without directoryName, When converting, Then directoryName defaults to empty string', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            noDirType: {
              id: 'nodirtype',
              name: 'NoDirType',
              suffix: 'ndt',
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const noDirType = metadata.find(m => m.xmlName === 'NoDirType')
        expect(noDirType?.directoryName).toBe('')
      })
    })

    describe('folder type filtering', () => {
      it('Given SDR type that is a folder type for an inFolder parent, When converting, Then it is excluded', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            report: {
              id: 'report',
              name: 'Report',
              directoryName: 'reports',
              inFolder: true,
              folderType: 'reportfolder',
              suffix: 'report',
            },
            reportfolder: {
              id: 'reportfolder',
              name: 'ReportFolder',
              directoryName: 'reports',
              suffix: 'reportFolder',
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const reportFolder = metadata.find(m => m.xmlName === 'ReportFolder')
        expect(reportFolder).toBeUndefined()
        const report = metadata.find(m => m.xmlName === 'Report')
        expect(report).toBeDefined()
      })
    })

    describe('content array for inFolder types', () => {
      it('Given Report type with folderType, When converting, Then content array includes both type and folder suffixes', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            report: {
              id: 'report',
              name: 'Report',
              directoryName: 'reports',
              inFolder: true,
              folderType: 'reportfolder',
              suffix: 'report',
            },
            reportfolder: {
              id: 'reportfolder',
              name: 'ReportFolder',
              directoryName: 'reports',
              suffix: 'reportFolder',
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const report = metadata.find(m => m.xmlName === 'Report')
        expect(report?.content).toEqual([
          { suffix: 'report', xmlName: 'Report' },
          { suffix: 'reportFolder', xmlName: 'ReportFolder' },
        ])
      })

      it('Given type in TYPES_WITH_CONTENT_ARRAY but missing folderType in registry, When converting, Then content is undefined', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            report: {
              id: 'report',
              name: 'Report',
              directoryName: 'reports',
              inFolder: true,
              folderType: 'nonexistent',
              suffix: 'report',
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const report = metadata.find(m => m.xmlName === 'Report')
        expect(report?.content).toBeUndefined()
      })
    })

    describe('child type conversion', () => {
      it('Given parent with child types, When converting, Then includes childXmlNames array', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            customobject: {
              id: 'customobject',
              name: 'CustomObject',
              directoryName: 'objects',
              suffix: 'object',
              children: {
                types: {
                  customfield: {
                    id: 'customfield',
                    name: 'CustomField',
                    suffix: 'field',
                  },
                  listview: {
                    id: 'listview',
                    name: 'ListView',
                    suffix: 'listView',
                  },
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const customObject = metadata.find(m => m.xmlName === 'CustomObject')
        expect(customObject?.childXmlNames).toContain('CustomField')
        expect(customObject?.childXmlNames).toContain('ListView')
      })

      it('Given child type with xmlElementName and uniqueIdElement, When converting, Then maps to xmlTag and key', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            workflow: {
              id: 'workflow',
              name: 'Workflow',
              directoryName: 'workflows',
              suffix: 'workflow',
              children: {
                types: {
                  workflowalert: {
                    id: 'workflowalert',
                    name: 'WorkflowAlert',
                    suffix: 'alert',
                    xmlElementName: 'alerts',
                    uniqueIdElement: 'fullName',
                  },
                },
                directories: {
                  alerts: 'workflows',
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const workflowAlert = metadata.find(m => m.xmlName === 'WorkflowAlert')
        expect(workflowAlert?.parentXmlName).toBe('Workflow')
        expect(workflowAlert?.xmlTag).toBe('alerts')
        expect(workflowAlert?.key).toBe('fullName')
      })

      it('Given child with same suffix as parent, When converting, Then child suffix is omitted', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            parent: {
              id: 'parent',
              name: 'Parent',
              directoryName: 'parents',
              suffix: 'shared',
              children: {
                types: {
                  child: {
                    id: 'child',
                    name: 'Child',
                    suffix: 'shared',
                  },
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const child = metadata.find(m => m.xmlName === 'Child')
        expect(child?.suffix).toBeUndefined()
      })

      it('Given child with different suffix from parent, When converting, Then child suffix is preserved', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            parent: {
              id: 'parent',
              name: 'Parent',
              directoryName: 'parents',
              suffix: 'parent',
              children: {
                types: {
                  child: {
                    id: 'child',
                    name: 'Child',
                    suffix: 'child',
                  },
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const child = metadata.find(m => m.xmlName === 'Child')
        expect(child?.suffix).toBe('child')
      })

      it('Given child of Translations parent, When converting, Then child is marked excluded', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            translations: {
              id: 'translations',
              name: 'Translations',
              directoryName: 'translations',
              suffix: 'translation',
              children: {
                types: {
                  customapplicationtranslation: {
                    id: 'customapplicationtranslation',
                    name: 'CustomApplicationTranslation',
                    suffix: 'appTranslation',
                  },
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const childTranslation = metadata.find(
          m => m.xmlName === 'CustomApplicationTranslation'
        )
        expect(childTranslation?.excluded).toBe(true)
      })

      it('Given child with directory matching parent, When converting, Then child directoryName is empty', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            parent: {
              id: 'parent',
              name: 'Parent',
              directoryName: 'shared',
              suffix: 'parent',
              children: {
                types: {
                  child: {
                    id: 'child',
                    name: 'Child',
                    suffix: 'child',
                    directoryName: 'shared',
                  },
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const child = metadata.find(m => m.xmlName === 'Child')
        expect(child?.directoryName).toBe('')
      })

      it('Given parent without directories map, When converting children, Then uses child directoryName fallback', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            parent: {
              id: 'parent',
              name: 'Parent',
              directoryName: 'parents',
              suffix: 'parent',
              children: {
                types: {
                  child: {
                    id: 'child',
                    name: 'Child',
                    suffix: 'child',
                    directoryName: 'childDir',
                  },
                },
              },
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const metadata = adapter.toInternalMetadata()

        // Assert
        const child = metadata.find(m => m.xmlName === 'Child')
        expect(child?.directoryName).toBe('childDir')
      })
    })

    describe('caching', () => {
      it('Given same registry instance, When calling toInternalMetadata twice, Then returns cached result', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            test: {
              id: 'test',
              name: 'Test',
              directoryName: 'tests',
              suffix: 'test',
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const firstCall = adapter.toInternalMetadata()
        const secondCall = adapter.toInternalMetadata()

        // Assert
        expect(firstCall).toBe(secondCall) // Same reference = cached
      })

      it('Given clearCache called, When calling toInternalMetadata, Then recomputes result', () => {
        // Arrange
        const mockRegistry: MockRegistry = {
          types: {
            test: {
              id: 'test',
              name: 'Test',
              directoryName: 'tests',
              suffix: 'test',
            },
          },
        }
        const adapter = new SDRMetadataAdapter(mockRegistry as never)

        // Act
        const firstCall = adapter.toInternalMetadata()
        SDRMetadataAdapter.clearCache()
        const secondCall = adapter.toInternalMetadata()

        // Assert
        expect(firstCall).not.toBe(secondCall) // Different reference = recomputed
        expect(firstCall).toEqual(secondCall) // Same content
      })
    })
  })
})
