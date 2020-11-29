'use strict'

const SubCustomObject = require('../../../../src/service/subCustomObjectHandler')
const InResource = require('../../../../src/service/inResourceHandler')
const Lightning = require('../../../../src/service/lightningHandler')
const InFolder = require('../../../../src/service/inFolderHandler')
const Standard = require('../../../../src/service/standardHandler')
const TypeHandlerFactory = require('../../../../src/service/typeHandlerFactory')
const SubFolderElementHandler = require('../../../../src/service/subFolderElementHandler')

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
    [Lightning, ['aura', 'lwc']],
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
    [InResource, ['staticresources']],
    [Standard, ['objects']],
    [SubFolderElementHandler, ['classes']],
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
