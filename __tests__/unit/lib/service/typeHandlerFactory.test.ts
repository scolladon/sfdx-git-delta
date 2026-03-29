'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

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
})
