'use strict'

const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')
const InResource = require('../../../../lib/service/inResourceHandler')
const Lightning = require('../../../../lib/service/lightningHandler')
const InFolder = require('../../../../lib/service/inFolderHandler')
const Standard = require('../../../../lib/service/standardHandler')
const TypeHandlerFactory = require('../../../../lib/service/typeHandlerFactory')

describe('the type handler factory', () => {
  let typeHandlerFactory
  beforeAll(() => {
    typeHandlerFactory = new TypeHandlerFactory({
      config: {},
      diffs: {},
      promises: [],
    })
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
        'reportTypes',
        'sharingReasons',
        'validationRules',
        'webLinks',
      ],
    ],
    [InFolder, ['dashboards', 'documents', 'reports']],
    [InResource, ['staticresources']],
    [Standard, ['objects']],
  ])('give %p handler', (handler, types) => {
    test.each(types)('for %s folder', type => {
      expect(
        typeHandlerFactory.getTypeHander(
          `Z       force-app/main/default/${type}/folder/file`
        )
      ).toBeInstanceOf(handler)
    })
  })
})
