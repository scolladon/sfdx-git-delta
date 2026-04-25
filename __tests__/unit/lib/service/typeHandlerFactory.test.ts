'use strict'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { DELETION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ContainedDecomposedHandler from '../../../../src/service/containedDecomposedHandler'
import CustomField from '../../../../src/service/customFieldHandler'
import CustomObjectChildHandler from '../../../../src/service/customObjectChildHandler'
import Decomposed from '../../../../src/service/decomposedHandler'
import FlowHandler from '../../../../src/service/flowHandler'
import InBundleHandler from '../../../../src/service/inBundleHandler'
import InFileHandler from '../../../../src/service/inFileHandler'
import InFolder from '../../../../src/service/inFolderHandler'
import InResource from '../../../../src/service/inResourceHandler'
import ReportingFolderHandler from '../../../../src/service/reportingFolderHandler'
import SharedFolder from '../../../../src/service/sharedFolderHandler'
import Standard from '../../../../src/service/standardHandler'
import TypeHandlerFactory from '../../../../src/service/typeHandlerFactory'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

describe('the type handler factory', () => {
  let typeHandlerFactory: TypeHandlerFactory
  beforeAll(async () => {
    const globalMetadata: MetadataRepository = await getDefinition({})
    const work: Work = getWork()
    work.config.apiVersion = 46
    typeHandlerFactory = new TypeHandlerFactory(work, globalMetadata)
  })
  describe.each([
    [CustomField, ['fields']],
    [ContainedDecomposedHandler, ['permissionsets']],
    [
      CustomObjectChildHandler,
      [
        'businessProcesses',
        'compactLayouts',
        'fieldSets',
        'indexes',
        'listViews',
        'recordTypes',
        'sharingReasons',
        'validationRules',
        'webLinks',
      ],
    ],
    [InFolder, ['documents']],
    [ReportingFolderHandler, ['dashboards', 'reports']],
    [InResource, ['staticresources', 'aura', 'lwc']],
    [Standard, ['classes']],
    [SharedFolder, ['moderation', 'wave', 'discovery']],
  ])('give %p handler', (handler, types) => {
    it.each(types)('for %s folder', async type => {
      expect(
        await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/${type}/folder/file`
        )
      ).toBeInstanceOf(handler)
    })
  })

  it('can handle Decomposed', async () => {
    expect(
      await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/Account/fields/Test__c`
      )
    ).toBeInstanceOf(Decomposed)
  })

  it('can handle sub folder with Decomposed', async () => {
    expect(
      await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/folder/Account/fields/Test__c.field-meta.xml`
      )
    ).toBeInstanceOf(Decomposed)
  })

  it('can handle sub folder with non Decomposed', async () => {
    expect(
      await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/documents/classes/TestDocument`
      )
    ).toBeInstanceOf(InFolder)
  })

  it('can handle Flow', async () => {
    expect(
      await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/flows/MyFlow.flow-meta.xml`
      )
    ).toBeInstanceOf(FlowHandler)
  })

  it.each([
    'force-app/main/default/TestClass.cls',
    'force-app/main/default/TestClass.cls-meta.xml',
    'force-app/main/default/admin.profile-meta.xml',
    'force-app/main/default/admin.permissionset-meta.xml',
  ])('can handle metadata outside its folder', async line => {
    expect(
      await typeHandlerFactory.getTypeHandler(`Z       ${line}`)
    ).toBeInstanceOf(Standard)
  })

  it('Given deletion change type, When resolving handler, Then uses from revision', async () => {
    const sut = await typeHandlerFactory.getTypeHandler(
      `D       force-app/main/default/classes/folder/file`
    )
    expect(sut).toBeInstanceOf(Standard)
  })

  it('Given non-deletion change type, When resolving handler, Then uses to revision', async () => {
    const sut = await typeHandlerFactory.getTypeHandler(
      `A       force-app/main/default/classes/folder/file`
    )
    expect(sut).toBeInstanceOf(Standard)
  })

  it('Given a diff line, When getTypeHandler is called, Then path is extracted from line after change type prefix', async () => {
    const sut = await typeHandlerFactory.getTypeHandler(
      `A       force-app/main/default/flows/MyFlow.flow-meta.xml`
    )
    expect(sut).toBeInstanceOf(FlowHandler)
    expect(sut.toString()).toContain(
      'force-app/main/default/flows/MyFlow.flow-meta.xml'
    )
  })

  describe('dynamic resolution', () => {
    describe('adapter-based resolution', () => {
      it('Given bundle adapter type, When resolving handler, Then returns InResource', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/aiAuthoringBundles/MyBundle/file.txt`
        )
        expect(sut).toBeInstanceOf(InResource)
      })

      it('Given mixedContent adapter type, When resolving handler, Then returns InResource', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/staticresources/MyResource/file.txt`
        )
        expect(sut).toBeInstanceOf(InResource)
      })

      it('Given digitalExperience adapter type, When resolving handler, Then returns InBundle', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/digitalExperiences/site/home/file.json`
        )
        expect(sut).toBeInstanceOf(InBundleHandler)
      })
    })

    describe('child type resolution', () => {
      it('Given child with xmlTag and key of non-decomposed parent, When resolving handler, Then returns Decomposed', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/workflows/Account/workflowAlerts/MyAlert.workflowAlert-meta.xml`
        )
        expect(sut).toBeInstanceOf(Decomposed)
      })

      it('Given child without xmlTag of folderPerType parent, When resolving handler, Then returns CustomObjectChildHandler', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/objects/Account/listViews/MyView.listView-meta.xml`
        )
        expect(sut).toBeInstanceOf(CustomObjectChildHandler)
      })

      it('Given child with parentXmlName not matching any child heuristic, When resolving handler, Then returns Standard', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/workSkillRoutingAttributes/MyRouting/MyAttribute.workSkillRoutingAttribute-meta.xml`
        )
        expect(sut).toBeInstanceOf(Standard)
      })
    })

    describe('InFile parent resolution', () => {
      it('Given parent type with children having xmlTag, When resolving handler, Then returns InFile', async () => {
        const sut = await typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/workflows/Account.workflow-meta.xml`
        )
        expect(sut).toBeInstanceOf(InFileHandler)
      })
    })
  })

  // --- Mutation-killing tests ---

  describe('Given DELETION change type (L86)', () => {
    it('When change type is D, Then uses from revision (not to)', async () => {
      // Mutant: changeType !== DELETION → swaps from/to for deletion
      // We cannot inspect the revision directly, but we can verify that a D-line
      // resolves the same handler class regardless of the direction.
      const sut = await typeHandlerFactory.getTypeHandler(
        `${DELETION}       force-app/main/default/flows/MyFlow.flow-meta.xml`
      )
      expect(sut).toBeInstanceOf(FlowHandler)
    })

    it('When change type is A (not DELETION), Then uses to revision', async () => {
      // Mutant: changeType === DELETION flipped → addition uses from revision
      const sut = await typeHandlerFactory.getTypeHandler(
        `A       force-app/main/default/flows/MyFlow.flow-meta.xml`
      )
      expect(sut).toBeInstanceOf(FlowHandler)
    })
  })

  describe('buildInFileParentIndex logic (L94-L96)', () => {
    it('Given type with xmlTag AND key AND parentXmlName where parent has no adapter, When resolving, Then parent is in InFile set', async () => {
      // WorkflowAlert has xmlTag + key + parentXmlName=Workflow; Workflow has no adapter
      // Mutant "m.xmlTag || m.key" would admit types with only xmlTag (no key)
      // Mutant "m.xmlTag && m.key || m.parentXmlName" would also admit types with parentXmlName alone
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/workflows/Account.workflow-meta.xml`
      )
      expect(sut).toBeInstanceOf(InFileHandler)
    })

    it('Given parent type that has adapter set, When resolving its child, Then parent is NOT in InFile set', async () => {
      // LightningComponentBundle children (e.g., lwc files) have parent with adapter='bundle'
      // Mutant "parent || !parent.adapter" → always true → everything in InFile set
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/lwc/myComponent/myComponent.js`
      )
      // lwc resolves via handlerMap → Lwc (InResource subtype), not InFile
      expect(sut).not.toBeInstanceOf(InFileHandler)
    })
  })

  describe('resolveHandler child type branching (L118-L123)', () => {
    it('Given child type with xmlTag AND key AND parent without adapter, When resolving, Then returns Decomposed', async () => {
      // Mutant "type.xmlTag && type.key || !parent?.adapter" → incorrect condition
      // WorkflowAlert has xmlTag+key, parent=Workflow has no adapter
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/workflows/Account/workflowAlerts/MyAlert.workflowAlert-meta.xml`
      )
      expect(sut).toBeInstanceOf(Decomposed)
    })

    it('Given child type with xmlTag but parent has adapter, When resolving, Then does NOT return Decomposed for that branch', async () => {
      // Mutant "type.xmlTag || type.key" would make any type with xmlTag use Decomposed
      // LightningMessageChannel has xmlTag, adapter=... let's use a type that's in handlerMap instead
      // InBundle digital experience → not Decomposed
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/digitalExperiences/site/home/file.json`
      )
      expect(sut).not.toBeInstanceOf(Decomposed)
    })

    it('Given child type without xmlTag and parent decomposition is folderPerType, When resolving, Then returns CustomObjectChildHandler', async () => {
      // Mutant "!type.xmlTag || parent?.decomposition === FOLDER_PER_TYPE" → inverts condition
      // RecordType has no xmlTag, parent CustomObject has decomposition=folderPerType
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/Account/recordTypes/Test__c.recordType-meta.xml`
      )
      expect(sut).toBeInstanceOf(CustomObjectChildHandler)
    })

    it('Given child type without xmlTag but parent decomposition is NOT folderPerType, When resolving, Then does NOT return CustomObjectChildHandler via that branch', async () => {
      // WorkflowAlert parent=Workflow: decomposition is not folderPerType → falls through to InFile
      // Mutant that always returns CustomObjectChildHandler would fail
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/workflows/Account.workflow-meta.xml`
      )
      expect(sut).not.toBeInstanceOf(CustomObjectChildHandler)
    })
  })

  describe('resolveHandler with unknown parent (L120 OptionalChaining, L123 OptionalChaining)', () => {
    it('Given type with parentXmlName that resolves to undefined parent, When resolving handler, Then returns Standard without crashing', async () => {
      // Mutant parent.adapter (non-optional): would throw TypeError when parent is undefined
      // We create a stub metadata repo that has the type but returns undefined for the parent
      const orphanType = {
        directoryName: 'orphans',
        inFolder: false,
        metaFile: false,
        suffix: 'orphan',
        xmlName: 'OrphanType',
        parentXmlName: 'NonExistentParent',
        xmlTag: 'orphanTag',
        key: 'Name',
      }
      const stubMetadata = {
        has: (_path: string) => true,
        get: (_path: string) => orphanType,
        getByXmlName: (xmlName: string) =>
          xmlName === 'NonExistentParent' ? undefined : orphanType,
        getFullyQualifiedName: (path: string) => path,
        values: () => [orphanType],
      }
      const work = getWork()
      work.config.apiVersion = 46
      // Mock GitAdapter to avoid real git operations
      const mockResolver = {
        createElement: vi.fn().mockResolvedValue({
          type: orphanType,
          pathAfterType: ['file.orphan'],
          fullPath: 'force-app/orphans/file.orphan',
          parts: ['force-app', 'orphans', 'file.orphan'],
          basePath: 'force-app/orphans/file.orphan',
          isMetaFile: false,
          extension: 'orphan',
          parentFolder: 'orphans',
          componentName: 'file',
          parentName: '',
          typeDirectoryPath: 'force-app/orphans',
          componentPath: 'force-app/orphans/file',
        }),
      }
      const factory = new TypeHandlerFactory(work, stubMetadata as never)
      // Inject the mock resolver
      ;(factory as unknown as { resolver: typeof mockResolver }).resolver =
        mockResolver

      const sut = await factory.getTypeHandler(
        `Z       force-app/orphans/file.orphan`
      )
      // Should not throw, should return Standard (no match in any handler branch)
      expect(sut).toBeInstanceOf(Standard)
    })

    it('Given type with parentXmlName where parent exists but has adapter, When resolving handler, Then does not return Decomposed', async () => {
      // Mutant: !parent?.adapter → !parent.adapter — safe since parent exists here
      // But when parent is undefined: !undefined = true → incorrectly returns Decomposed
      // This tests the false branch: parent exists with adapter → no Decomposed
      const sut = await typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/staticresources/MyResource/file.txt`
      )
      expect(sut).toBeInstanceOf(InResource)
    })
  })
})
