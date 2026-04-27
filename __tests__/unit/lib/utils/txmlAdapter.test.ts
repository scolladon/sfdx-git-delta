'use strict'
import { describe, expect, it, vi } from 'vitest'

vi.mock('txml', () => ({
  parse: vi.fn(() => {
    throw new Error('boom')
  }),
}))

describe('txmlAdapter', () => {
  describe('Given a parser that throws (txmlAdapter L165 catch branch)', () => {
    it('When parseXml is called, Then it swallows the error and returns {}', async () => {
      // Arrange — `txml.parse` is mocked above to always throw. This is
      // the only way to exercise the catch in parseXml: txml itself is
      // intentionally tolerant and won't throw on malformed strings.
      const { parseXml } = await import('../../../../src/utils/txmlAdapter')

      // Act
      const sut = parseXml('<Root>x</Root>')

      // Assert — error is swallowed and {} is returned per the contract
      expect(sut).toStrictEqual({})
    })
  })
})
