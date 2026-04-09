'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../../../../src/types/config'
import { readPathFromGit } from '../../../../src/utils/fsHelper'
import {
  convertJsonToXml,
  parseXmlFileToJson,
  xml2Json,
} from '../../../../src/utils/xmlHelper'

const mockedReadPathFromGit = vi.mocked(readPathFromGit)

vi.mock('../../../../src/utils/fsHelper')

describe('xmlHelper', () => {
  describe('parseXmlFileToJson', () => {
    const config: Config = {
      from: '',
      to: '',
      output: '',
      source: [''],
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
          { path: 'path/to/empty/file', oid: config.to },
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
          { path: 'path/to/empty/file', oid: config.to },
          config
        )

        // Assert
        expect(jsonContent).toEqual({
          root: { '@_a': 'nice', '@_checked': true, a: 'wow' },
        })
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
          { path: 'path/to/empty/file', oid: config.to },
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
        expect(jsonContent).toEqual({
          root: { '@_a': 'nice', '@_checked': true, a: 'wow' },
        })
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

  describe('Given xml with comments', () => {
    it('When parsed, Then preserves comments under #comment key', () => {
      // Arrange
      const xmlWithComment = '<root><!-- a comment --><a>value</a></root>'

      // Act
      const sut = xml2Json(xmlWithComment)

      // Assert
      expect(sut).toHaveProperty('root.#comment')
      expect(
        (sut as Record<string, Record<string, unknown>>).root['#comment']
      ).toContain(' a comment ')
    })
  })

  describe('Given xml with namespace prefix', () => {
    it('When parsed, Then preserves namespace in tag name', () => {
      // Arrange
      const xmlWithNs =
        '<ns:root xmlns:ns="http://example.com"><ns:child>val</ns:child></ns:root>'

      // Act
      const sut = xml2Json(xmlWithNs)

      // Assert
      expect(sut).toHaveProperty('ns:root')
    })
  })

  describe('Given xml with tag values that look like numbers', () => {
    it('When parsed, Then preserves values as strings', () => {
      // Arrange
      const xmlWithNumber = '<root><version>42</version></root>'

      // Act
      const sut = xml2Json(xmlWithNumber)

      // Assert
      const version = (sut as Record<string, Record<string, unknown>>).root
        .version
      expect(typeof version).toBe('string')
      expect(version).toBe('42')
    })
  })

  describe('Given xml with attribute values that look like numbers', () => {
    it('When parsed, Then preserves attribute values as strings', () => {
      // Arrange
      const xmlWithAttrNumber = '<root count="10">text</root>'

      // Act
      const sut = xml2Json(xmlWithAttrNumber)

      // Assert
      const count = (sut as Record<string, Record<string, unknown>>).root[
        '@_count'
      ]
      expect(typeof count).toBe('string')
      expect(count).toBe('10')
    })
  })

  describe('Given xml with whitespace around values', () => {
    it('When parsed, Then trims the values', () => {
      // Arrange
      const xmlWithSpaces = '<root><a>  hello  </a></root>'

      // Act
      const sut = xml2Json(xmlWithSpaces)

      // Assert
      expect((sut as Record<string, Record<string, unknown>>).root.a).toBe(
        'hello'
      )
    })
  })

  describe('Given xml with entities like &amp;', () => {
    it('When parsed with processEntities=false, Then does not process entity references', () => {
      // Arrange
      const xmlWithEntity = '<root><a>foo &amp; bar</a></root>'

      // Act
      const sut = xml2Json(xmlWithEntity)

      // Assert
      const value = (sut as Record<string, Record<string, unknown>>).root.a
      expect(value).toBe('foo &amp; bar')
    })
  })

  describe('Given json with boolean attribute', () => {
    it('When converted to xml, Then boolean attribute is rendered', () => {
      // Arrange
      const json = { root: { '@_checked': true, a: 'wow' } }

      // Act
      const sut = convertJsonToXml(json)

      // Assert
      expect(sut).toContain('checked')
    })
  })

  describe('Given json with empty node', () => {
    it('When converted to xml, Then empty node is rendered with open/close tags', () => {
      // Arrange
      const json = { root: { empty: '' } }

      // Act
      const sut = convertJsonToXml(json)

      // Assert
      expect(sut).toContain('<empty>')
      expect(sut).toContain('</empty>')
    })
  })
})
