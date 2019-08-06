'use strict'

const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')
const InResource = require('../../../../lib/service/inResourceHandler')
const Lightning = require('../../../../lib/service/lightningHandler')
const InFolder = require('../../../../lib/service/inFolderHandler')
const Standard = require('../../../../lib/service/standardHandler')
const TypeHandlerFactory = require('../../../../lib/service/typeHandlerFactory')

test('typeHandlerFactory-aura', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/aura/AuraComponent/AuraComponent.cmp'
  )
  expect(handler).toBeInstanceOf(Lightning)
})

test('typeHandlerFactory-businessProcesses', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/objects/Account/businessProcesses/awesome.businessProcesse-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-compactLayouts', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/objects/Account/compactLayouts/awesome.compactLayout-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-dashboards', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/dashboards/Folder/awesome.dashboard-meta.xml'
  )
  expect(handler).toBeInstanceOf(InFolder)
})

test('typeHandlerFactory-documents', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/documents/Folder/awesome.document-meta.xml'
  )
  expect(handler).toBeInstanceOf(InFolder)
})

test('typeHandlerFactory-fieldSets', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/fieldSets/awesome.fieldSet-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-fields', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/fields/awesome.field-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-listViews', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/listViews/awesome.listView-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-lwc', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/lwc/LightningWebComponent/LightningWebComponent.js'
  )
  expect(handler).toBeInstanceOf(Lightning)
})

test('typeHandlerFactory-recordTypes', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/recordTypes/awesome.recordType-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-reportTypes', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/reportTypes/awesome.reportType-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-reports', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/reports/Folder/awesome.report-meta.xml'
  )
  expect(handler).toBeInstanceOf(InFolder)
})

test('typeHandlerFactory-sharingReasons', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/sharingReasons/awesome.sharingReason-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-staticresources', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/staticresources/resourceName.resource-meta.xml'
  )
  expect(handler).toBeInstanceOf(InResource)
})

test('typeHandlerFactory-validationRules', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/validationRules/awesome.validationRule-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-webLinks', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander(
    'A       force-app/main/default/Account/webLinks/awesome.webLink-meta.xml'
  )
  expect(handler).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-other', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const handler = typeHandlerFactory.getTypeHander('')
  expect(handler).toBeInstanceOf(Standard)
})
