'use strict'

const SubCustomObject = require('../../../../src/service/subCustomObjectHandler')
const InResource = require('../../../../src/service/inResourceHandler')
const InFolder = require('../../../../src/service/inFolderHandler')
const Standard = require('../../../../src/service/standardHandler')
const TypeHandlerFactory = require('../../../../src/service/typeHandlerFactory')

describe('the type handler factory', () => {
  let typeHandlerFactory
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    const globalMetadata = await getGlobalMetadata()
    typeHandlerFactory = new TypeHandlerFactory(
      {
        config: { apiVersion: '46' },
        diffs: { package: new Map(), destructiveChanges: new Map() },
        promises: [],
      }, // eslint-disable-next-line no-undef
      globalMetadata
    )
  })
  describe.each([
    [
      SubCustomObject,
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
  ])('give %p handler', (handler, types) => {
    test.each(types)('for %s folder', type => {
      expect(
        typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/${type}/folder/file`
        )
      ).toBeInstanceOf(handler)
    })
  })

  test('can handle SubCustomObject', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/Account/fields/Test__c`
      )
    ).toBeInstanceOf(SubCustomObject)
  })

  test('can handle sub folder with SubCustomObject', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/objects/folder/Account/fields/Test__c`
      )
    ).toBeInstanceOf(SubCustomObject)
  })

  test('can handle sub folder with non SubCustomObject', () => {
    expect(
      typeHandlerFactory.getTypeHandler(
        `Z       force-app/main/default/documents/classes/TestDocument`
      )
    ).toBeInstanceOf(InFolder)
  })
})
