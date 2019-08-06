'use strict'

const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')
const InResource = require('../../../../lib/service/inResourceHandler')
const Lightning = require('../../../../lib/service/lightningHandler')
const InFolder = require('../../../../lib/service/inFolderHandler')
const Standard = require('../../../../lib/service/standardHandler')
const TypeHandlerFactory = require('../../../../lib/service/typeHandlerFactory')

test('typeHandlerFactory-SubCustomObject', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const builder = typeHandlerFactory.getTypeHander('')
  expect(builder).toBeInstanceOf(SubCustomObject)
})

test('typeHandlerFactory-InResource', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const builder = typeHandlerFactory.getTypeHander('')
  expect(builder).toBeInstanceOf(InResource)
})

test('typeHandlerFactory-Lightning', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const builder = typeHandlerFactory.getTypeHander('')
  expect(builder).toBeInstanceOf(Lightning)
})

test('typeHandlerFactory-InFolder', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const builder = typeHandlerFactory.getTypeHander('')
  expect(builder).toBeInstanceOf(InFolder)
})

test('typeHandlerFactory-Standard', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const builder = typeHandlerFactory.getTypeHander('')
  expect(builder).toBeInstanceOf(Standard)
})

test('permissionHandlerFactory-unknown', () => {
  const typeHandlerFactory = new TypeHandlerFactory({
    config: {},
    diffs: {},
    promises: [],
  })
  const builder = typeHandlerFactory.getTypeHander('')
  expect(builder).toBeInstanceOf(Standard)
})
