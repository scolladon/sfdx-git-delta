'use strict'
const metadataManager = require('../../../../lib/metadata/metadataManager')
const metadata = metadataManager.getDefinition('directoryName', '46')

describe(`test if metadata`, () => {
  test('when grouped per directoryName, have classes', () => {
    expect(metadata).toHaveProperty('classes')
  })

  test('when grouped per directoryName, do not have do not exist', () => {
    expect(metadata).not.toHaveProperty('do not exist')
  })
})
