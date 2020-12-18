'use strict'

const SubCustomObject = require('../../../../src/service/subCustomObjectHandler')
const InResource = require('../../../../src/service/inResourceHandler')
const InFolder = require('../../../../src/service/inFolderHandler')
const Standard = require('../../../../src/service/standardHandler')
const TypeHandlerFactory = require('../../../../src/service/typeHandlerFactory')

describe('the type handler factory', () => {
  let typeHandlerFactory
  beforeAll(() => {
    typeHandlerFactory = new TypeHandlerFactory(
      {
        config: { apiVersion: '46' },
        diffs: { package: {}, destructiveChanges: {} },
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
    [Standard, ['objects']],
  ])('give %p handler', (handler, types) => {
    test.each(types)('for %s folder', type => {
      expect(
        typeHandlerFactory.getTypeHandler(
          `Z       force-app/main/default/${type}/folder/file`
        )
      ).toBeInstanceOf(handler)
    })
  })
})
