'use strict'
import { expect, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import Decomposed from '../../../../src/service/decomposedHandler'
import HangingDecomposed from '../../../../src/service/hangingDecomposedHandler'
import InFolder from '../../../../src/service/inFolderHandler'
import InResource from '../../../../src/service/inResourceHandler'
import SharedFolder from '../../../../src/service/sharedFolderHandler'
import Standard from '../../../../src/service/standardHandler'
import TypeHandlerFactory from '../../../../src/service/typeHandlerFactory'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

describe('the type handler factory', () => {
  let typeHandlerFactory: TypeHandlerFactory
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    const globalMetadata: MetadataRepository = await getGlobalMetadata()
    const work: Work = getWork()
    work.config.apiVersion = 46
    typeHandlerFactory = new TypeHandlerFactory(work, globalMetadata)
  })
  describe.each([
    [HangingDecomposed, ['permissionsets']],
    [
      Decomposed,
      [
        'businessProcesses',
        'compactLayouts',
        'fieldSets',
        'fields',
        'listViews',
        'recordTypes',
        'sharingReasons',
        'validationRules',
        'webLinks',
      ],
    ],
    [InFolder, ['dashboards', 'documents', 'reports']],
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

  it('can handle hanging decomposed', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/permissionsets/admin/applicationVisibilities/admin.applicationVisibility`
      )
    ).toBeInstanceOf(HangingDecomposed)

    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/permissionsets/folder/admin/applicationVisibilities/admin.applicationVisibility`
      )
    ).toBeInstanceOf(HangingDecomposed)
  })

  it('can handle hanging decomposed not decomposed (old format)', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/permissionsets/admin.permissionset`
      )
    ).toBeInstanceOf(HangingDecomposed)

    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/permissionsets/folder/admin.permissionset`
      )
    ).toBeInstanceOf(HangingDecomposed)
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
