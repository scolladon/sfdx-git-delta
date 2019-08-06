'use strict'

const SubCustomObject = require('../../../../lib/service/subCustomObjectHandler')
const fieldType = 'fields'

test('subCustomObjectHandler-addition', () => {
  const handler = new SubCustomObject(
    'A       force-app/main/default/Account/fields/awesome.field-meta.xml',
    fieldType,
    {
      config: {},
      diffs: {},
      promises: [],
    }
  )

  //expect(handler).toBeInstanceOf(Lightning)
})

test('subCustomObjectHandler-deletion', () => {
  const handler = new SubCustomObject(
    'A       force-app/main/default/Account/fields/awesome.field-meta.xml',
    fieldType,
    {
      config: {},
      diffs: {},
      promises: [],
    }
  )

  //expect(handler).toBeInstanceOf(Lightning)
})

test('subCustomObjectHandler-modification', () => {
  const handler = new SubCustomObject(
    'A       force-app/main/default/Account/fields/awesome.field-meta.xml',
    fieldType,
    {
      config: {},
      diffs: {},
      promises: [],
    }
  )

  //expect(handler).toBeInstanceOf(Lightning)
})

test('subCustomObjectHandler-renaming', () => {
  const handler = new SubCustomObject(
    'A       force-app/main/default/Account/fields/awesome.field-meta.xml',
    fieldType,
    {
      config: {},
      diffs: {},
      promises: [],
    }
  )

  //expect(handler).toBeInstanceOf(Lightning)
})
