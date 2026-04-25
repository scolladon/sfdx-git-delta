'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../../../../src/types/config'
import { readPathFromGit } from '../../../../src/utils/fsHelper'
import { parseXmlFileToJson, xml2Json } from '../../../../src/utils/xmlHelper'

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
      it('returns json content', () => {
        // Act
        const jsonContent = xml2Json('<root a="nice" checked><a>wow</a></root>')

        // Assert
        expect(jsonContent).toEqual({
          root: { '@_a': 'nice', '@_checked': true, a: 'wow' },
        })
      })
    })
    describe('when called with non xml content', () => {
      it('returns empty object', () => {
        // Act
        const jsonContent = xml2Json(JSON.stringify({ attribute: 'value' }))

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

  describe('Given txmlAdapter branch coverage (addChild / addComment / parseXml)', () => {
    it('When parsing three siblings of the same name nested two deep, Then the inner array.push branch fires (txmlAdapter L78-80)', () => {
      // Arrange — three sibling <a> tags inside a wrapper. tNodeToXmlContent
      // walks them, sees the wrapper, then recurses; the third <a> inside
      // hits `Array.isArray(existing)` → existing.push(child) branch.
      const xml = '<root><wrap><a>1</a><a>2</a><a>3</a></wrap></root>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      const wrap = (sut as Record<string, Record<string, unknown>>).root
        .wrap as Record<string, unknown>
      expect(wrap.a).toEqual(['1', '2', '3'])
    })

    it('When parsing two siblings of the same name, Then the scalar→array upgrade branch fires (txmlAdapter L82)', () => {
      // Arrange — exactly two <a> children: existing is scalar, second
      // call upgrades to [first, second].
      const xml = '<root><a>x</a><a>y</a></root>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      expect((sut as Record<string, Record<string, unknown>>).root.a).toEqual([
        'x',
        'y',
      ])
    })

    it('When parsing three sibling comments nested in a wrapper, Then addComment array.push fires (txmlAdapter L91-93)', () => {
      // Arrange
      const xml = '<root><wrap><!-- a --><!-- b --><!-- c --></wrap></root>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      const wrap = (sut as Record<string, Record<string, unknown>>).root
        .wrap as Record<string, unknown>
      expect(wrap['#comment']).toEqual([' a ', ' b ', ' c '])
    })

    it('When parsing two top-level comments, Then top-level scalar→array upgrade fires (txmlAdapter L95)', () => {
      // Arrange
      const xml = '<!-- one --><!-- two --><Root/>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      expect(sut['#comment']).toEqual([' one ', ' two '])
    })

    it('When parsing three top-level comments, Then top-level array.push fires (txmlAdapter L91-93 at top level)', () => {
      // Arrange
      const xml = '<!-- a --><!-- b --><!-- c --><Root/>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      expect(sut['#comment']).toEqual([' a ', ' b ', ' c '])
    })

    it('When parsing an inner element with attributes but no children, Then attributes-only object is returned (txmlAdapter L108 sub 0)', () => {
      // Arrange — inner `<inner attr="x"/>` triggers tNodeToXmlContent's
      // attributes-only arm: `node.children.length === 0 && hasAttributes`
      const xml = '<root><inner attr="x"/></root>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      const inner = (sut as Record<string, Record<string, unknown>>).root.inner
      expect(inner).toEqual({ '@_attr': 'x' })
    })

    it('When parsing a document with an XML declaration, Then the ?xml branch is taken (txmlAdapter L158-159)', () => {
      // Arrange — declaration plus a root. Hits the `if (child.tagName ===
      // XML_HEADER_ATTRIBUTE_KEY)` branch that copies the declaration's
      // attributes onto out['?xml'].
      const xml = '<?xml version="1.0" encoding="UTF-8"?><Root>x</Root>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      expect(sut['?xml']).toEqual({
        '@_version': '1.0',
        '@_encoding': 'UTF-8',
      })
      expect(sut.Root).toBe('x')
    })

    it('When parsing three top-level <Root/> siblings, Then top-level addChild array.push fires (txmlAdapter L153-154 at top level)', () => {
      // Arrange — three top-level elements with the same tag name.
      // Top-level addChild collapses them to an array.
      const xml = '<A>1</A><A>2</A><A>3</A>'

      // Act
      const sut = xml2Json(xml)

      // Assert
      expect(sut.A).toEqual(['1', '2', '3'])
    })

    it('When the source has top-level whitespace between elements, Then the top-level whitespace branch is taken (txmlAdapter L158-159)', () => {
      // Arrange — leading whitespace before the root element. txml emits
      // the whitespace as a top-level string child; parseXml's
      // `typeof child === 'string'` branch skips it.
      const xml = '   \n  <Root>x</Root>'

      // Act
      const sut = xml2Json(xml)

      // Assert — root parses cleanly with no leakage from the whitespace
      expect(sut).toEqual({ Root: 'x' })
    })
  })

  describe('Given the xmlContent guard (if (!xmlContent) return {})', () => {
    it.each([
      null,
      undefined,
      0,
      false,
    ])('When xml2Json receives falsy value %s, Then returns empty object without calling parser', falsy => {
      // Arrange — any falsy xmlContent must trigger the early-return guard
      // at L34. If the ConditionalExpression is mutated to `false` the
      // guard never fires and the parser is called with a falsy string,
      // producing either an error or unexpected output.
      const sut = xml2Json(falsy as unknown as string)

      // Assert
      expect(sut).toStrictEqual({})
    })

    it('When xml2Json receives a non-empty string, Then does NOT early-return (guard only fires for falsy)', () => {
      // Arrange — verifies the guard does not fire for truthy input.
      // If ConditionalExpression were mutated to `true` this would return {}
      // for valid XML, breaking the parse path.
      const sut = xml2Json('<root><a>1</a></root>')

      // Assert — parsed content must be present
      expect(sut).not.toStrictEqual({})
      expect(sut).toHaveProperty('root')
    })
  })
})
