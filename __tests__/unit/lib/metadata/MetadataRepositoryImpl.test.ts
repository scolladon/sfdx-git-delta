'use strict'
import { beforeEach, describe, expect, it } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { MetadataRepositoryImpl } from '../../../../src/metadata/MetadataRepositoryImpl'
import type { Metadata } from '../../../../src/types/metadata'

// Hoisted so a test can build its own MetadataRepositoryImpl subclass
// against the exact same registry entries the shared beforeEach uses.
const registryFixture: Metadata[] = [
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
    adapter: 'mixedContent',
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
    adapter: 'matchingContentFile',
    directoryName: 'classes',
    inFolder: false,
    metaFile: true,
    suffix: 'cls',
    xmlName: 'ApexClass',
  },
  {
    adapter: 'bundle',
    directoryName: 'lwc',
    inFolder: false,
    metaFile: false,
    xmlName: 'LightningComponentBundle',
  },
  {
    adapter: 'mixedContent',
    directoryName: 'staticresources',
    inFolder: false,
    metaFile: true,
    suffix: 'resource',
    xmlName: 'StaticResource',
  },
  {
    directoryName: 'icons',
    inFolder: false,
    metaFile: false,
    suffix: 'icon',
    xmlName: 'Icon',
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
    adapter: 'mixedContent',
    directoryName: 'experiences',
    inFolder: false,
    metaFile: true,
    suffix: 'site',
    xmlName: 'ExperienceBundle',
  },
  {
    adapter: 'digitalExperience',
    directoryName: 'digitalExperiences',
    inFolder: false,
    metaFile: false,
    xmlName: 'DigitalExperienceBundle',
  },
  {
    directoryName: 'portals',
    inFolder: false,
    metaFile: false,
    suffix: 'portal',
    xmlName: 'Portal',
  },
  // The SDR-style WaveDashboard/WaveXmd entries register `wdash`/`xmd` a
  // second time (alongside VirtualWave.content below), marking those
  // suffixes UNSAFE so searchByExtension yields and the directory walk —
  // where the nested-folder bug lives — becomes the deciding path. Mirrors
  // the real registry, where SDR and the internal registry both define them.
  {
    adapter: 'matchingContentFile',
    directoryName: 'wave',
    inFolder: false,
    metaFile: true,
    suffix: 'wdash',
    xmlName: 'WaveDashboard',
  },
  {
    adapter: 'matchingContentFile',
    directoryName: 'wave',
    inFolder: false,
    metaFile: true,
    suffix: 'xmd',
    xmlName: 'WaveXmd',
  },
  {
    directoryName: 'wave',
    inFolder: false,
    metaFile: true,
    content: [
      { suffix: 'wdash', xmlName: 'WaveDashboard' },
      { suffix: 'xmd', xmlName: 'WaveXmd' },
    ],
    xmlName: 'VirtualWave',
  } as Metadata,
  {
    directoryName: 'dashboards',
    inFolder: true,
    metaFile: true,
    suffix: 'dashboard',
    xmlName: 'Dashboard',
  },
  // VirtualBot is a sibling virtual content-container; it locks the fix's
  // symmetry across all virtual content-container types — the predicate
  // keys off the non-empty content[], never xmlName.
  {
    adapter: 'matchingContentFile',
    directoryName: 'bots',
    inFolder: false,
    metaFile: true,
    suffix: 'botVersion',
    xmlName: 'BotVersion',
  },
  {
    directoryName: 'bots',
    inFolder: false,
    metaFile: true,
    content: [
      { suffix: 'bot', xmlName: 'Bot' },
      { suffix: 'botVersion', xmlName: 'BotVersion' },
    ],
    xmlName: 'VirtualBot',
  } as Metadata,
  {
    directoryName: 'permissionsets',
    inFolder: false,
    metaFile: false,
    suffix: 'permissionset',
    xmlName: 'PermissionSet',
  },
  {
    directoryName: 'objectTranslations',
    inFolder: false,
    metaFile: false,
    suffix: 'objectTranslation',
    xmlName: 'CustomObjectTranslation',
  },
  {
    inFolder: false,
    metaFile: false,
    suffix: 'assignmentRule',
    xmlName: 'AssignmentRule',
  } as Metadata,
]

describe('MetadataRepositoryImpl', () => {
  let sut: MetadataRepository
  beforeEach(() => {
    sut = new MetadataRepositoryImpl(registryFixture)
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

      it('matches deeper metadata when project folder matches a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z portals/experiences/Component/routes/file.json'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'experiences' })
        )
      })

      it('matches deepest valid metadata when multiple metadata dirs exist', () => {
        // Act
        const result = sut.get('Z classes/experiences/Component/file.json')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'experiences' })
        )
      })

      it('matches the mixedContent container type when a nested content folder collides with a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/staticresources/myResource/assets/icons/new.svg'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'staticresources' })
        )
      })

      it('matches the bundle container type when a nested content folder collides with a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/lwc/myComponent/icons/spinner.svg'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'lwc' })
        )
      })

      it('matches the digitalExperience container type when a nested content folder collides with a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/digitalExperiences/site/home/classes/data.json'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'digitalExperiences' })
        )
      })

      it('keeps matching the deepest type when a non-container type owns a colliding nested folder', () => {
        // Act
        const result = sut.get('Z force-app/main/classes/sub/icons/glyph.svg')

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'icons' })
        )
      })

      it('matches the virtual content-container when a nested content folder collides with a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/src-base/crma/wave/dashboards/Account_KPI_Dashboard.wdash'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'wave' })
        )
      })

      it('matches the virtual content-container for a file directly under it', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/wave/Seller_Homepage.wdash'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'wave' })
        )
      })

      it('matches a sibling virtual content-container when a nested content folder collides with a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/bots/MyBot/dashboards/v1.botVersion'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'bots' })
        )
      })

      it('matches the virtual content-container for a nested non-first content suffix colliding with a metadata directory name', () => {
        // Act
        const result = sut.get(
          'Z force-app/main/default/src-base/crma/wave/dashboards/Account_KPI_Dashboard.xmd-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual(
          expect.objectContaining({ directoryName: 'wave' })
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

    describe('Given a bare type name offered as a path', () => {
      it('When it is resolved, Then it is not a component and the name lookup stays with getByXmlName', () => {
        // Act
        const result = sut.get('AuraDefinitionBundle')

        // Assert
        expect(result).toBeUndefined()
        expect(sut.getByXmlName('AuraDefinitionBundle')).toStrictEqual(
          expect.objectContaining({ directoryName: 'aura' })
        )
      })

      it('When a diff line names a repository-root file after a type, Then it is not a component', () => {
        // Act
        const result = sut.has('A\tAuraDefinitionBundle')

        // Assert
        expect(result).toBe(false)
      })

      it('When the name matches no type at all, Then nothing resolves', () => {
        // Act
        const result = sut.get('DoNotExist')

        // Assert
        expect(result).toBeUndefined()
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

  describe('Given a registered xmlName', () => {
    it('When it is looked up by name, Then its registry entry answers', () => {
      // Act
      const result = sut.getByXmlName('AuraDefinitionBundle')

      // Assert
      expect(result).toStrictEqual(
        expect.objectContaining({ directoryName: 'aura' })
      )
    })
  })

  describe('Given a repository whose package directory is the repository root', () => {
    // Counts calls into the search chain so a test can prove the diff line
    // and the bare path share one pathCache entry, rather than merely
    // sharing the same registry object the search chain would have
    // returned anyway.
    class CountingRepository extends MetadataRepositoryImpl {
      public searches = 0
      protected override searchByExtension(parts: string[]) {
        this.searches += 1
        return super.searchByExtension(parts)
      }
    }

    it('When a diff line names a type only its directory resolves, Then the status prefix does not hide that directory', () => {
      // Act
      const result = sut.get('A\taura/comp/comp.js')

      // Assert
      expect(result).toStrictEqual(
        expect.objectContaining({ xmlName: 'AuraDefinitionBundle' })
      )
    })

    it('When the diff line is offered to has, Then the component is recognised', () => {
      // Act
      const result = sut.has('D\taura/comp/comp.js')

      // Assert
      expect(result).toBe(true)
    })

    it('When the same file arrives as a diff line and as a bare path, Then the registry searches once', () => {
      // Arrange
      const counting = new CountingRepository(registryFixture)

      // Act
      const fromDiffLine = counting.get('A\tclasses/Foo.cls')
      const fromBarePath = counting.get('classes/Foo.cls')

      // Assert
      expect(counting.searches).toBe(1)
      expect(fromDiffLine).toBe(fromBarePath)
    })
  })

  describe('Given a path whose first segment is one character followed by a space', () => {
    it('When it is resolved, Then the diff-status regex strips that segment too', () => {
      // A real Salesforce package directory is never one character followed
      // by a space, so this collision is unreachable in practice;
      // GIT_DIFF_TYPE_REGEX is deliberately left as-is here.

      // Act
      const result = sut.get('a aura/comp/comp.js')

      // Assert
      expect(result).toStrictEqual(
        expect.objectContaining({ xmlName: 'AuraDefinitionBundle' })
      )
    })
  })

  describe('getFullyQualifiedName', () => {
    describe('Given a path resolving to no type', () => {
      it('When the fully qualified name is derived, Then it answers with the basename', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'Z force-app/main/folder/TestFactory'
        )

        // Assert
        expect(result).toStrictEqual('TestFactory')
      })
    })

    describe('Given a decomposed holder and its child files', () => {
      it('When a PermissionSet is spelled three ways, Then every spelling answers the same key', () => {
        // Act
        const keys = [
          sut.getFullyQualifiedName('permissionsets/PS.permissionset-meta.xml'),
          sut.getFullyQualifiedName(
            'permissionsets/PS/PS.permissionset-meta.xml'
          ),
          sut.getFullyQualifiedName(
            'permissionsets/PS/objectSettings/Account.objectSettings-meta.xml'
          ),
        ]

        // Assert
        expect(new Set(keys).size).toBe(1)
        expect(keys[0]).toStrictEqual('permissionsets/PS')
      })

      it('When a CustomObjectTranslation is spelled two ways, Then every spelling answers the same key', () => {
        // Act
        const keys = [
          sut.getFullyQualifiedName(
            'objectTranslations/X-fr/X-fr.objectTranslation-meta.xml'
          ),
          sut.getFullyQualifiedName(
            'objectTranslations/X-fr/Account.fieldTranslation-meta.xml'
          ),
        ]

        // Assert
        expect(new Set(keys).size).toBe(1)
        expect(keys[0]).toStrictEqual('objectTranslations/X-fr')
      })
    })

    describe('Given a holder-scoped path whose type directory never appears in it', () => {
      it('When resolved by suffix alone, Then it answers with the basename', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'src/PS.permissionset-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual('PS.permissionset-meta.xml')
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

    describe('Given a plain type file sitting directly in its type directory', () => {
      it('When its fully qualified name is derived, Then the answer carries the type directory and the file', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'Z force-app/main/classes/TestFactory.cls'
        )

        // Assert
        expect(result).toStrictEqual('classes/TestFactory.cls')
      })
    })

    describe('Given a plain type file sitting outside its type directory', () => {
      it('When its fully qualified name is derived, Then the answer carries the directory the registry resolved, not the one on disk', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'Z force-app/main/TestFactory.cls'
        )

        // Assert
        expect(result).toStrictEqual('classes/TestFactory.cls')
      })
    })

    describe('Given a plain type file and its meta companion', () => {
      it('When both are resolved, Then they answer the same key', () => {
        // Act
        const withoutCompanion = sut.getFullyQualifiedName(
          'classes/TestFactory.cls'
        )
        const withCompanion = sut.getFullyQualifiedName(
          'classes/TestFactory.cls-meta.xml'
        )

        // Assert
        expect(withCompanion).toStrictEqual(withoutCompanion)
      })
    })

    describe('Given the same plain type file filed under two different package directories', () => {
      it('When both are resolved, Then they answer the same key', () => {
        // Act
        const underMain = sut.getFullyQualifiedName(
          'Z force-app/main/classes/TestFactory.cls'
        )
        const underAnother = sut.getFullyQualifiedName(
          'Z another-app/classes/TestFactory.cls'
        )

        // Assert
        expect(underAnother).toStrictEqual(underMain)
      })
    })

    describe('Given two plain types declaring one suffix under different directories', () => {
      it('When both are resolved, Then they stay apart', () => {
        // Act
        const site = sut.getFullyQualifiedName('sites/ASite.site')
        const siteDotCom = sut.getFullyQualifiedName(
          'siteDotComSites/ASite.site'
        )

        // Assert
        expect(site).not.toStrictEqual(siteDotCom)
      })
    })

    describe('Given a plain type with no directoryName', () => {
      it('When resolved by suffix alone, Then it answers with the basename', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'force-app/main/Foo.assignmentRule'
        )

        // Assert
        expect(result).toStrictEqual('Foo.assignmentRule')
      })
    })

    describe('Given a content-container path that never carries its type directory', () => {
      it('When a content-container path never carries its type directory, Then it answers with the basename', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'force-app/main/myResource.resource-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual('myResource.resource-meta.xml')
      })
    })

    describe('Given an inFolder type file with a varying extension', () => {
      it('When two files share a folder but differ by extension, Then they answer the same key', () => {
        // Act
        const keys = [
          sut.getFullyQualifiedName('documents/Assets/logo.png'),
          sut.getFullyQualifiedName('documents/Assets/logo.jpg'),
        ]

        // Assert
        expect(new Set(keys).size).toBe(1)
        expect(keys[0]).toStrictEqual('documents/Assets/logo')
      })

      it('When a folder file and its meta companion are resolved, Then they answer the same key', () => {
        // Act
        const withoutCompanion = sut.getFullyQualifiedName(
          'documents/Assets/README'
        )
        const withCompanion = sut.getFullyQualifiedName(
          'documents/Assets/README-meta.xml'
        )

        // Assert
        expect(withCompanion).toStrictEqual(withoutCompanion)
      })

      it('When two same-named documents sit under different folders, Then they stay apart', () => {
        // Act
        const assets = sut.getFullyQualifiedName('documents/Assets/logo.png')
        const other = sut.getFullyQualifiedName('documents/Other/logo.png')

        // Assert
        expect(assets).not.toStrictEqual(other)
      })

      it('When the path carries a package prefix, Then the key still anchors on the type directory', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'force-app/main/default/documents/Assets/logo.png'
        )

        // Assert
        expect(result).toStrictEqual('documents/Assets/logo')
      })
    })

    describe('Given a bundle content container', () => {
      it('When every file of the bundle is resolved, Then they all answer the container directory', () => {
        // Act
        const keys = [
          sut.getFullyQualifiedName('lwc/foo/foo.js'),
          sut.getFullyQualifiedName('lwc/foo/foo.html'),
          sut.getFullyQualifiedName('lwc/foo/foo.js-meta.xml'),
        ]

        // Assert
        expect(new Set(keys).size).toBe(1)
        expect(keys[0]).toStrictEqual('lwc/foo')
      })

      it('When the container directory name contains a dot, Then the whole name is kept', () => {
        // Act
        const result = sut.getFullyQualifiedName('lwc/foo.bar/foo.bar.js')

        // Assert
        expect(result).toStrictEqual('lwc/foo.bar')
      })
    })

    describe('Given a mixedContent container named by a file below its type directory', () => {
      it('When compared to a file nested inside the resulting directory, Then they answer the same key', () => {
        // Act
        const namedByFile = sut.getFullyQualifiedName(
          'staticresources/R.resource-meta.xml'
        )
        const nestedContent = sut.getFullyQualifiedName(
          'staticresources/R/content/a.txt'
        )

        // Assert
        expect(nestedContent).toStrictEqual(namedByFile)
        expect(namedByFile).toStrictEqual('staticresources/R')
      })
    })

    describe('Given a digitalExperience content container at the depth boundary', () => {
      it('When exactly four segments follow the type directory, Then the bundle depth applies', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'digitalExperiences/site/B/home/fr.json'
        )

        // Assert
        expect(result).toStrictEqual('digitalExperiences/site/B')
      })

      it('When more than four segments follow the type directory, Then the content depth applies', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'digitalExperiences/site/B/sfdc_cms__view/home/content.json'
        )

        // Assert
        expect(result).toStrictEqual(
          'digitalExperiences/site/B/sfdc_cms__view/home'
        )
      })
    })

    describe('Given a digitalExperience content container path carrying a package prefix', () => {
      it('When exactly four segments follow the type directory, Then the bundle depth still applies', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'force-app/main/default/digitalExperiences/site/B/home/fr.json'
        )

        // Assert
        expect(result).toStrictEqual('digitalExperiences/site/B')
      })

      it('When more than four segments follow the type directory, Then the content depth still applies', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'force-app/main/default/digitalExperiences/site/B/sfdc_cms__view/home/content.json'
        )

        // Assert
        expect(result).toStrictEqual(
          'digitalExperiences/site/B/sfdc_cms__view/home'
        )
      })
    })

    describe('Given nested content families sharing one flat directory', () => {
      it('When two families differ only by extension, Then they answer different keys', () => {
        // Act
        const wdash = sut.getFullyQualifiedName('wave/A.wdash')
        const xmd = sut.getFullyQualifiedName('wave/A.xmd')

        // Assert
        expect(wdash).not.toStrictEqual(xmd)
      })

      it('When a file sits under a sub-directory, Then the sub-directory is discarded from the key', () => {
        // Act
        const nested = sut.getFullyQualifiedName('wave/Grp/A.wdash')
        const direct = sut.getFullyQualifiedName('wave/A.wdash')

        // Assert
        expect(nested).toStrictEqual(direct)
      })
    })

    describe('Given a folder-scoped nested content type', () => {
      it('When two BotVersions belong to different bots, Then they stay apart', () => {
        // Act
        const first = sut.getFullyQualifiedName(
          'bots/FirstBot/v1.botVersion-meta.xml'
        )
        const second = sut.getFullyQualifiedName(
          'bots/SecondBot/v1.botVersion-meta.xml'
        )

        // Assert
        expect(first).not.toStrictEqual(second)
      })

      it('When the path carries a package prefix, Then the bot folder is still kept', () => {
        // Act
        const result = sut.getFullyQualifiedName(
          'force-app/main/default/bots/MyBot/v1.botVersion-meta.xml'
        )

        // Assert
        expect(result).toStrictEqual('bots/MyBot/v1.botVersion')
      })
    })
  })

  describe('Given a composed type outside any registry directory', () => {
    it('When the fully qualified name is derived, Then the file name stands in for the missing scope', () => {
      // Act
      const result = sut.getFullyQualifiedName('A\tsrc/Foo.object-meta.xml')

      // Assert
      expect(result).toBe('Foo.object-meta.xml')
    })
  })

  describe('Given a composed component under a directory whose name merely contains a type directory', () => {
    it('When both spellings are derived, Then the key anchors on the type segment and both agree', () => {
      // Arrange
      const shadowed =
        'A\tobjects_backup/objects/Account/fields/Test__c.field-meta.xml'
      const plain = 'A\tforce-app/objects/Account/fields/Test__c.field-meta.xml'

      // Act
      const keys = new Set([
        sut.getFullyQualifiedName(shadowed),
        sut.getFullyQualifiedName(plain),
      ])

      // Assert
      expect(keys).toStrictEqual(
        new Set(['objectsAccountfieldsTest__c.field-meta.xml'])
      )
    })
  })

  describe('Given a folder-organised file whose name ends in Folder', () => {
    it('When it is keyed beside its extension-bearing sibling, Then both answer with one name, as the folder handler derives it', () => {
      // Act
      const keys = new Set([
        sut.getFullyQualifiedName('A\tdocuments/Assets/logoFolder'),
        sut.getFullyQualifiedName('A\tdocuments/Assets/logo.png'),
      ])

      // Assert
      expect(keys).toStrictEqual(new Set(['documents/Assets/logo']))
    })
  })

  describe('Given two registries built in one process', () => {
    it('When the first declares a suffix twice and the second declares it once, Then the second still resolves that suffix by extension', () => {
      // Arrange — the ambiguity a registry finds among its own entries stays
      // its own: an additional registry loaded for one run must not decide
      // what an extension means for a registry built after it.
      const thing = {
        directoryName: 'things',
        inFolder: false,
        metaFile: false,
        suffix: 'thing',
        xmlName: 'Thing',
      }
      const ambiguous = new MetadataRepositoryImpl([
        thing,
        { ...thing, directoryName: 'otherThings', xmlName: 'OtherThing' },
      ] as Metadata[])
      const sut = new MetadataRepositoryImpl([thing] as Metadata[])

      // Act
      const shadowed = ambiguous.get('src/Alpha.thing')
      const result = sut.get('src/Alpha.thing')

      // Assert
      expect(shadowed).toBeUndefined()
      expect(result).toStrictEqual(
        expect.objectContaining({ xmlName: 'Thing' })
      )
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
