'use strict'
const FileUtils = require('../../../../lib/utils/fileUtils')
jest.mock('fs')

describe(`test if FileUtils`, () => {
  let fu

  beforeAll(() => {
    fu = new FileUtils({ output: '' })
  })
  test('can write async', async () => {
    await expect(fu.writeChangesAsync('awesome', 'package.xml')).resolves.toBe(
      'package.xml'
    )
  })

  test('do anything when empty filename and content', async () => {
    await expect(fu.writeChangesAsync('', '')).resolves.toBeUndefined()
  })
})
