'use strict'
import { expect, describe, it } from '@jest/globals'
import { MetadataRepositoryImpl } from '../../../../src/metadata/MetadataRepositoryImpl'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { Metadata } from '../../../../src/types/metadata'

describe('MetadataRepositoryImpl', () => {
  let sut: MetadataRepository
  beforeEach(() => {
    sut = new MetadataRepositoryImpl([
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
        directoryName: 'documents',
        inFolder: true,
        metaFile: true,
        suffix: 'document',
        xmlName: 'Document',
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
        directoryName: 'restrictionRules',
        inFolder: false,
        metaFile: false,
        suffix: 'rule',
        xmlName: 'RestrictionRule',
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
    ])
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
      it('matches on folder', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/folder/aura/TestApp/TestApp.app'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'aura' })
        )
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
      sut = new MetadataRepositoryImpl(metadata)

      // Act
      const result = sut.values()

      // Assert
      expect(result).toBe(metadata)
    })
  })
})
