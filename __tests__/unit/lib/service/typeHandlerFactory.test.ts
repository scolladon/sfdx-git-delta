'use strict'
import { describe, expect, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import ContainedDecomposedHandler from '../../../../src/service/containedDecomposedHandler'
import CustomField from '../../../../src/service/customFieldHandler'
import CustomObjectChildHandler from '../../../../src/service/customObjectChildHandler'
import Decomposed from '../../../../src/service/decomposedHandler'
import FlowHandler from '../../../../src/service/flowHandler'
import InFolder from '../../../../src/service/inFolderHandler'
import InResource from '../../../../src/service/inResourceHandler'
import ReportingFolderHandler from '../../../../src/service/reportingFolderHandler'
import SharedFolder from '../../../../src/service/sharedFolderHandler'
import Standard from '../../../../src/service/standardHandler'
import TypeHandlerFactory from '../../../../src/service/typeHandlerFactory'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

describe('the type handler factory', () => {
  let typeHandlerFactory: TypeHandlerFactory
  beforeAll(async () => {
    const globalMetadata: MetadataRepository = await getGlobalMetadata()
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
    it.each(types)('for %s folder', type => {
      expect(
        typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/${type}/folder/file`
        )
      ).toBeInstanceOf(handler)
    })
  })

  it('can handle Decomposed', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/Account/fields/Test__c`
      )
    ).toBeInstanceOf(Decomposed)
  })

  it('can handle sub folder with Decomposed', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/folder/Account/fields/Test__c.field-meta.xml`
      )
    ).toBeInstanceOf(Decomposed)
  })

  it('can handle sub folder with non Decomposed', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/documents/classes/TestDocument`
      )
    ).toBeInstanceOf(InFolder)
  })

  it('can handle Flow', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/flows/MyFlow.flow-meta.xml`
      )
    ).toBeInstanceOf(FlowHandler)
  })

  it.each([
    'force-app/main/default/TestClass.cls',
    'force-app/main/default/TestClass.cls-meta.xml',
    'force-app/main/default/admin.profile-meta.xml',
    'force-app/main/default/admin.permissionset-meta.xml',
  ])('can handle metadata outside its folder', line => {
    expect(typeHandlerFactory.getTypeHandler(`Z       ${line}`)).toBeInstanceOf(
      Standard
    )
  })
})
