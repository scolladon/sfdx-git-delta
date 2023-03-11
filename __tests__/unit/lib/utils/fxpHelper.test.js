'use strict'
const {
  asArray,
  parseXmlFileToJson,
  convertJsonToXml,
} = require('../../../../src/utils/fxpHelper')
const { readPathFromGit } = require('../../../../src/utils/fsHelper')

jest.mock('../../../../src/utils/fsHelper')

describe('fxpHelper', () => {
  describe('asArray', () => {
    describe('when called with null', () => {
      // Arrange
      const expected = null

      it('returns empty array', () => {
        // Act
        const actual = asArray(expected)

        // Assert
        expect(actual).toEqual([])
      })
    })
    describe('when called with array', () => {
      // Arrange
      const expected = [{ test: true }]

      it('returns the same array', () => {
        // Act
        const actual = asArray(expected)

        // Assert
        expect(actual).toBe(expected)
      })
    })
    describe('when called with object', () => {
      // Arrange
      const expected = { test: true }

      it('returns the array with this object', () => {
        // Act
        const actual = asArray(expected)

        // Assert
        expect(actual).toEqual([expected])
      })
    })
  })
  describe('parseXmlFileToJson', () => {
    describe('when called with empty content', () => {
      beforeEach(() => {
        // Arrange
        readPathFromGit.mockResolvedValueOnce('')
      })
      it('returns empty object', async () => {
        // Act
        const jsonResult = await parseXmlFileToJson('path/to/empty/file', {})

        // Assert
        expect(jsonResult).toStrictEqual({})
      })
    })
    describe('when called with xml content', () => {
      beforeEach(() => {
        // Arrange
        readPathFromGit.mockResolvedValueOnce(
          '<root a="nice" checked><a>wow</a></root>'
        )
      })
      it('returns json content', async () => {
        // Act
        const jsonContent = await parseXmlFileToJson('path/to/empty/file', {})

        // Assert
        expect(jsonContent).toEqual({ root: { '@_a': 'nice', a: 'wow' } })
      })
    })
    describe('when called with non xml content', () => {
      beforeEach(() => {
        // Arrange
        readPathFromGit.mockResolvedValueOnce({ attribut: 'value' })
      })
      it('returns empty object', async () => {
        // Act
        const jsonContent = await parseXmlFileToJson('path/to/empty/file', {})

        // Assert
        expect(jsonContent).toStrictEqual({})
      })
    })
  })

  describe('convertJsonToXml', () => {
    describe('when called with empty object', () => {
      it('returns empty object', () => {
        // Act
        const xmlResult = convertJsonToXml({})

        // Assert
        expect(xmlResult).toEqual('')
      })
    })
    describe('when called with json content', () => {
      it('returns json content', () => {
        // Act
        const xmlResult = convertJsonToXml({
          root: { '@_a': 'nice', a: 'wow' },
        })

        // Assert
        expect(xmlResult).toEqual(
          `<root a="nice">
    <a>wow</a>
</root>
`
        )
      })
    })
    describe('when called with non json content', () => {
      it('returns empty object', () => {
        // Act
        const jsonContent = convertJsonToXml('s')

        // Assert
        expect(jsonContent).toStrictEqual(`<0>s</0>
`)
      })
    })
  })
})
