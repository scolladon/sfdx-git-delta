'use strict'
const { getType: sut } = require('../../../../src/utils/typeUtils')

describe('typeUtils', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  describe('getType', () => {
    describe('when passing "having subtypes" kind of line', () => {
      it('can get object type', () => {
        const line =
          'force-app/main/sample/objects/Account/fields/aField.field-meta.xml'

        const result = sut(line, globalMetadata)

        expect(result).toEqual('fields')
      })
      it('can get territory model type', () => {
        const line =
          'force-app/main/sample/territory2Models/EU/territories/France.territory2-meta.xml'

        const result = sut(line, globalMetadata)

        expect(result).toEqual('territories')
      })
    })

    describe('when passing "normal type" of line', () => {
      it('can get empty type', () => {
        const line = 'force-app/main/default/classes/Added.cls'

        const result = sut(line, globalMetadata)

        expect(result).toEqual('classes')
      })
    })
  })
})
