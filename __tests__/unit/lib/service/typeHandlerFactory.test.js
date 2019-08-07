'use strict'

const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')
const InResource = require('../../../../lib/service/inResourceHandler')
const Lightning = require('../../../../lib/service/lightningHandler')
const InFolder = require('../../../../lib/service/inFolderHandler')
const Standard = require('../../../../lib/service/standardHandler')
const TypeHandlerFactory = require('../../../../lib/service/typeHandlerFactory')

describe('the type handler factory', () => {
  const pathTemplate = type =>
    `Z       force-app/main/default/${type}/folder/file`
  let typeHandlerFactory
  beforeAll(() => {
    typeHandlerFactory = new TypeHandlerFactory({
      config: {},
      diffs: {},
      promises: [],
    })
  })
  test.each([
    [Lightning, 'aura'],
    [SubCustomObject, 'businessProcesses'],
    [SubCustomObject, 'compactLayouts'],
    [InFolder, 'dashboards'],
    [InFolder, 'documents'],
    [SubCustomObject, 'fieldSets'],
    [SubCustomObject, 'fields'],
    [SubCustomObject, 'listViews'],
    [Lightning, 'lwc'],
    [SubCustomObject, 'recordTypes'],
    [SubCustomObject, 'reportTypes'],
    [InFolder, 'reports'],
    [SubCustomObject, 'sharingReasons'],
    [InResource, 'staticresources'],
    [SubCustomObject, 'validationRules'],
    [SubCustomObject, 'webLinks'],
    [Standard, 'objects'],
  ])('give %o handler for %s', (handler, type) => {
    expect(typeHandlerFactory.getTypeHander(pathTemplate(type))).toBeInstanceOf(
      handler
    )
  })
})
