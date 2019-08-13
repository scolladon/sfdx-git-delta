'use strict'
const DiffHandler = require('../../../lib/diffHandler')
jest.mock('child_process')
jest.mock('fs-extra')
jest.mock('fs')

const mySpawn = require('mock-spawn')()
require('child_process').spawn = mySpawn

describe(`test if diffHandler`, () => {
  let diffHandler

  beforeEach(() => {
    diffHandler = new DiffHandler({ output: '', repo: '' })
  })

  test('can parse git correctly', async () => {
    mySpawn.setDefault(mySpawn.simple(0, ''))
    const work = await diffHandler.diff()
    expect(work.diffs).toStrictEqual({})
  })

  test('can resolve destructive change', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'D      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    const work = await diffHandler.diff()
    expect(work.diffs).toMatchObject({
      fields: new Set(['Account.awesome']),
    })
  })

  test('can resolve file copy when new file is added', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'A      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    const work = await diffHandler.diff()
    expect(work.diffs).toStrictEqual({})
  })

  test('can resolve file copy when file is modified', async () => {
    mySpawn.setDefault(
      mySpawn.simple(
        0,
        'M      force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
      )
    )
    const work = await diffHandler.diff()
    expect(work.diffs).toStrictEqual({})
  })

  test('can reject in case of error', async () => {
    const expected = 'Test Error'
    mySpawn.setDefault(mySpawn.simple(1, null, expected))

    try {
      await diffHandler.diff()
    } catch (e) {
      expect(e).toBe(expected)
    }
  })
})
