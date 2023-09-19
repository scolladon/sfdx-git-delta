'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import {
  asArray,
  parseXmlFileToJson,
  convertJsonToXml,
  xml2Json,
} from '../../../../src/utils/fxpHelper'
import { readPathFromGit } from '../../../../src/utils/fsHelper'
import { Config } from '../../../../src/types/config'

const mockedReadPathFromGit = jest.mocked(readPathFromGit)

jest.mock('../../../../src/utils/fsHelper')

describe('fxpHelper', () => {
  describe('asArray', () => {
    describe('when called with array', () => {
      // Arrange
      const expected = ['test']

      it('returns the same array', () => {
        // Act
        const actual = asArray(expected)

        // Assert
        expect(actual).toBe(expected)
      })
    })
    describe('when called with object', () => {
      // Arrange
      const expected = 'test'

      it('returns the array with this object', () => {
        // Act
        const actual = asArray(expected)

        // Assert
        expect(actual).toEqual([expected])
      })
    })
  })
  describe('parseXmlFileToJson', () => {
    const config: Config = {
      from: '',
      to: '',
      output: '',
      source: '',
      ignore: '',
      ignoreDestructive: '',
      apiVersion: 0,
      repo: '',
      ignoreWhitespace: false,
      generateDelta: false,
      include: '',
      includeDestructive: '',
    }
    describe('when called with empty content', () => {
      beforeEach(() => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce('')
      })
      it('returns empty object', async () => {
        // Act
        const jsonResult = await parseXmlFileToJson(
          'path/to/empty/file',
          config
        )

        // Assert
        expect(jsonResult).toStrictEqual({})
      })
    })
    describe('when called with xml content', () => {
      beforeEach(() => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce(
          '<root a="nice" checked><a>wow</a></root>'
        )
      })
      it('returns json content', async () => {
        // Act
        const jsonContent = await parseXmlFileToJson(
          'path/to/empty/file',
          config
        )

        // Assert
        expect(jsonContent).toEqual({ root: { '@_a': 'nice', a: 'wow' } })
      })
    })
    describe('when called with non xml content', () => {
      beforeEach(() => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce('{"attribute": "value"}')
      })
      it('returns empty object', async () => {
        // Act
        const jsonContent = await parseXmlFileToJson(
          'path/to/empty/file',
          config
        )

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

  describe('xml2Json', () => {
    describe('when called with empty content', () => {
      it('returns empty object', () => {
        // Act
        const jsonResult = xml2Json('')

        // Assert
        expect(jsonResult).toStrictEqual({})
      })
    })
    describe('when called with xml content', () => {
      it('returns json content', async () => {
        // Act
        const jsonContent = await xml2Json(
          '<root a="nice" checked><a>wow</a></root>'
        )

        // Assert
        expect(jsonContent).toEqual({ root: { '@_a': 'nice', a: 'wow' } })
      })
    })
    describe('when called with non xml content', () => {
      it('returns empty object', async () => {
        // Act
        const jsonContent = await xml2Json(
          JSON.stringify({ attribute: 'value' })
        )

        // Assert
        expect(jsonContent).toStrictEqual({})
      })
    })
  })
})
