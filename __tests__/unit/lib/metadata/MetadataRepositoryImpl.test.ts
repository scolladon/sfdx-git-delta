'use strict'
import { expect, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { MetadataRepositoryImpl } from '../../../../src/metadata/MetadataRepositoryImpl'
import type { Metadata } from '../../../../src/types/metadata'

describe('MetadataRepositoryImpl', () => {
  let sut: MetadataRepository
  beforeEach(() => {
    sut = MetadataRepositoryImpl.getInstance([
      {
        directoryName: 'aura',
        inFolder: false,
        metaFile: false,
        xmlName: 'AuraDefinitionBundle',
      },
      {
        directoryName: 'applications',
        inFolder: false,
        metaFile: false,
        suffix: 'app',
        xmlName: 'CustomApplication',
      },
      {
        directoryName: 'customMetadata',
        inFolder: false,
        metaFile: false,
        suffix: 'md',
        xmlName: 'CustomMetadata',
      },
      {
        directoryName: 'documents',
        inFolder: true,
        metaFile: true,
        suffix: 'document',
        xmlName: 'Document',
      },
      {
        directoryName: 'restrictionRules',
        inFolder: false,
        metaFile: false,
        suffix: 'rule',
        xmlName: 'RestrictionRule',
      },
      {
        directoryName: 'moderation',
        inFolder: false,
        metaFile: false,
        content: [
          {
            suffix: 'keywords',
            xmlName: 'KeywordList',
          },
          {
            suffix: 'rule',
            xmlName: 'ModerationRule',
          },
        ],
      } as Metadata,
      {
        directoryName: 'fields',
        inFolder: false,
        metaFile: false,
        suffix: 'field',
        xmlName: 'CustomField',
      },
      {
        childXmlNames: [
          'CustomField',
          'Index',
          'BusinessProcess',
          'RecordType',
          'CompactLayout',
          'WebLink',
          'ValidationRule',
          'SharingReason',
          'ListView',
          'FieldSet',
        ],
        directoryName: 'objects',
        inFolder: false,
        metaFile: false,
        suffix: 'object',
        xmlName: 'CustomObject',
      },
      {
        directoryName: 'classes',
        inFolder: false,
        metaFile: true,
        suffix: 'cls',
        xmlName: 'ApexClass',
      },
      {
        directoryName: 'lwc',
        inFolder: false,
        metaFile: false,
        xmlName: 'LightningComponentBundle',
      },
      {
        directoryName: 'staticresources',
        inFolder: false,
        metaFile: true,
        suffix: 'resource',
        xmlName: 'StaticResource',
      },
      {
        directoryName: 'emailservices',
        inFolder: false,
        metaFile: false,
        suffix: 'xml',
        xmlName: 'EmailServicesFunction',
      },
      {
        directoryName: 'sites',
        inFolder: false,
        metaFile: false,
        suffix: 'site',
        xmlName: 'CustomSite',
      },
      {
        directoryName: 'siteDotComSites',
        inFolder: false,
        metaFile: true,
        suffix: 'site',
        xmlName: 'SiteDotCom',
      },
      {
        directoryName: 'experiences',
        inFolder: false,
        metaFile: true,
        suffix: 'site',
        xmlName: 'ExperienceBundle',
      },
    ])
  })
  afterEach(() => {
    MetadataRepositoryImpl.resetForTest()
  })
  describe('has', () => {
    describe('when matching on folder', () => {
      it('returns true', () => {
        // Act
        const result = sut.has('Z force-app/main/documents/folder/logo.png')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('when matching on extension', () => {
      it('returns true', () => {
        // Act
        const result = sut.has('Z force-app/main/folder/TestFactory.cls')

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('when no match is found', () => {
      it('returns false', () => {
        // Act
        const result = sut.has('Z force-app/main/folder/TestFactory')

        // Assert
        expect(result).toBe(false)
      })
    })
  })

  describe('get', () => {
    describe('when matching on folder', () => {
      it('matches metadata without specific extension', () => {
        // Act
        const result = sut.get('Z force-app/main/documents/folder/logo.png')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'documents' })
        )
      })

      it('matches metadata without specific extension inside another folder', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/documents/folder/subFolder/logo.png'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'documents' })
        )
      })

      it('matches metadata without specific extension inside another "metadata" folder', () => {
        // Act
        const result = sut.get('Z force-app/main/documents/classes/logo.png')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'documents' })
        )
      })

      it('matches sub folder metadata', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/objects/Account/fields/CustomField'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'fields' })
        )
      })

      it('matches parent folder metadata', () => {
        // Act
        const result = sut.get('Z force-app/main/objects/Account/Account')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'objects' })
        )
      })

      it('matches shared folder metadata', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/moderation/site.block.rule-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'moderation' })
        )
      })

      describe('special cases where it should only match on folder', () => {
        it('matches `md` files inside `customMetadata` folder', () => {
          // Act
          const result = sut.get(
            'force-app/customMetadata/testCustomMetadata.md'
          )

          // Assert
          expect(result).toStrictEqual(
            expect.objectContaining({ directoryName: 'customMetadata' })
          )
        })
        it('matches `xml` files inside `emailservices` folder', () => {
          // Act
          const result = sut.get('force-app/emailservices/testService.xml')

          // Assert
          expect(result).toStrictEqual(
            expect.objectContaining({ directoryName: 'emailservices' })
          )
        })
        it('should match `Site`', () => {
          // Act
          const result = sut.get('Z force-app/main/default/sites/aSite.site')

          // Assert
          expect(result).toStrictEqual(
            expect.objectContaining({ directoryName: 'sites' })
          )
        })
        it('should match `SiteDotCom`', () => {
          // Act
          const result = sut.get(
            'Z force-app/main/default/siteDotComSites/aSitedotcom.site'
          )

          // Assert
          expect(result).toStrictEqual(
            expect.objectContaining({ directoryName: 'siteDotComSites' })
          )
        })
        it('should match `ExperienceBundle`', () => {
          // Act
          const result = sut.get(
            'Z force-app/main/default/experiences/aCommunity.site'
          )

          // Assert
          expect(result).toStrictEqual(
            expect.objectContaining({ directoryName: 'experiences' })
          )
        })
      })
    })

    describe('when matching on extension', () => {
      it('matches metadata with specific extension inside its folder', () => {
        // Act
        const result = sut.get('Z force-app/main/classes/TestFactory.cls')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'classes' })
        )
      })
      it('matches metadata with specific extension outside its folder', () => {
        // Act
        const result = sut.get('Z force-app/main/TestFactory.cls')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'classes' })
        )
      })
      it('matches metadata with specific extension inside another metadata folder', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/documents/TestFactory.cls-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'classes' })
        )
      })

      it('matches sub folder metadata', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/objects/Account/fields/CustomField.field-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'fields' })
        )
      })

      it('matches parent folder metadata', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/objects/Account/Account.object-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'objects' })
        )
      })
    })

    describe('when no match is found', () => {
      it('returns undefined', () => {
        // Act
        const result = sut.get('Z force-app/main/folder/TestFactory')

        // Assert
        expect(result).toBeUndefined()
      })
    })

    describe('when it should not match on extension', () => {
      it('does not match `xml` files outside `emailservices` folder', () => {
        // Act
        const result = sut.get('manifest/specificTestClasses.xml')

        // Assert
        expect(result).toBeUndefined()
      })

      it('does not match `app` files outside `applications` folder', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/folder/aura/TestApp/TestApp.app'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'aura' })
        )
      })

      it('does not match `md` files outside `customMetadata` folder', () => {
        // Act
        const result = sut.get('README.md')

        // Assert
        expect(result).toBeUndefined()
      })
    })
  })

  describe('getFullyQualifiedName', () => {
    describe('when the metadata as its own folder', () => {
      it('returns the file', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'Z force-app/main/classes/TestFactory.cls'
        )

        // Assert
        expect(result).toStrictEqual('TestFactory.cls')
      })
    })

    describe('when the metadata also as a parent folder', () => {
      it('returns the parent folder with folder with sub folder with file', () => {
        // Act
        const fqn = 'objects/Account/fields/Test__c.field-meta.xml'
        const result = sut.getFullyQualifiedName(`Z force-app/main/${fqn}`)

        // Assert
        expect(result).toStrictEqual(fqn.split('/').join(''))
      })
    })

    describe('when the metadata is not in its folder', () => {
      it('returns the full path', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'Z force-app/main/TestFactory.cls'
        )

        // Assert
        expect(result).toStrictEqual('TestFactory.cls')
      })
    })
  })

  describe('values', () => {
    beforeEach(() => {
      MetadataRepositoryImpl.resetForTest()
    })
    it('returns the array of Metadata', () => {
      // Arrange
      const metadata = [
        {
          directoryName: 'A',
          inFolder: true,
          metaFile: false,
          xmlName: 'A',
        },
        {
          directoryName: 'B',
          inFolder: true,
          metaFile: false,
          xmlName: 'B',
        },
      ]
      sut = MetadataRepositoryImpl.getInstance(metadata)

      // Act
      const result = sut.values()

      // Assert
      expect(result).toBe(metadata)
    })
  })

  describe('getInFileAttributes', () => {
    beforeEach(() => {
      MetadataRepositoryImpl.resetForTest()
    })
    it('returns only inFiles attributes', async () => {
      // Arrange
      const sut = MetadataRepositoryImpl.getInstance([
        {
          directoryName: 'waveTemplates',
          inFolder: true,
          metaFile: false,
          xmlName: 'WaveTemplateBundle',
        },
        {
          directoryName: 'workflows.alerts',
          inFolder: false,
          metaFile: false,
          xmlName: 'WorkflowAlert',
          xmlTag: 'alerts',
          key: 'fullName',
        },
        {
          directoryName: 'excluded',
          inFolder: false,
          metaFile: false,
          xmlName: 'Excluded',
          xmlTag: 'excluded',
          key: 'other',
          excluded: true,
        },
      ])

      // Act
      const inFileAttributes = sut.getInFileAttributes()

      // Assert
      expect(inFileAttributes.has('waveTemplates')).toBe(false)
      expect(inFileAttributes.has('excluded')).toBe(true)
      expect(inFileAttributes.has('alerts')).toBe(true)
      expect(inFileAttributes.get('alerts')).toEqual({
        xmlName: 'WorkflowAlert',
        key: 'fullName',
        excluded: false,
      })
      expect(inFileAttributes.get('excluded')).toEqual({
        xmlName: 'Excluded',
        key: 'other',
        excluded: true,
      })

      // Act
      const otherInFileAttributes = sut.getInFileAttributes()

      // Assert
      expect(otherInFileAttributes).toBe(inFileAttributes)
    })
  })

  describe('getSharedFolderMetadata', () => {
    beforeEach(() => {
      MetadataRepositoryImpl.resetForTest()
    })
    it('returns shared folder metadata', async () => {
      // Arrange
      const sut = MetadataRepositoryImpl.getInstance([
        {
          directoryName: 'waveTemplates',
          inFolder: true,
          metaFile: false,
          xmlName: 'WaveTemplateBundle',
        } as Metadata,
        {
          directoryName: 'discovery',
          inFolder: false,
          metaFile: true,
          content: [
            {
              suffix: 'model',
              xmlName: 'DiscoveryAIModel',
            },
            {
              suffix: 'goal',
              xmlName: 'DiscoveryGoal',
            },
          ],
        } as Metadata,
      ])

      // Act
      const sharedFolderMetadata: Map<string, string> =
        sut.getSharedFolderMetadata()

      // Assert
      expect(sharedFolderMetadata.has('discovery')).toBe(false)
      expect(sharedFolderMetadata.has('goal')).toBe(true)
      expect(sharedFolderMetadata.has('model')).toBe(true)
      expect(sharedFolderMetadata.get('goal')).toEqual('DiscoveryGoal')
      expect(sharedFolderMetadata.get('model')).toEqual('DiscoveryAIModel')

      // Act
      const otherSharedFolderMetadata = sut.getSharedFolderMetadata()

      // Assert
      expect(otherSharedFolderMetadata).toBe(sharedFolderMetadata)
    })
  })
})
