'use strict'
import { expect, describe, it } from '@jest/globals'
import { getGlobalMetadata } from '../../../__utils__/globalTestHelper'
import { getType as sut } from '../../../../src/utils/typeUtils'
import { MetadataRepository } from '../../../../src/types/metadata'

describe('typeUtils', () => {
  let globalMetadata: MetadataRepository
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
      it('can get classes type', () => {
        const line = 'force-app/main/default/classes/Added.cls'

        const result = sut(line, globalMetadata)

        expect(result).toEqual('classes')
      })
    })

    it('returns empty string by default', () => {
      const line = 'force-app/main/default/Added.cls'

      const result = sut(line, globalMetadata)

      expect(result).toEqual('')
    })
  })
})
