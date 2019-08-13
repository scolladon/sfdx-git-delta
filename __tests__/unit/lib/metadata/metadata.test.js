'use strict'
const metadata = require('../../../../lib/metadata/metadata')

describe(`test if metadata`, () => {
  test('when grouped per directoryName, have classes', () => {
    expect(metadata('directoryName')).toHaveProperty('classes')
  })

  test('when grouped per directoryName, do not have do not exist', () => {
    expect(metadata('directoryName')).not.toHaveProperty('do not exist')
  })
})
