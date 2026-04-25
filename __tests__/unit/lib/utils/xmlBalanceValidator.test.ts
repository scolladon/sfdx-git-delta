'use strict'
import { describe, expect, it } from 'vitest'

import {
  MalformedXmlError,
  validateXml,
} from '../../../../src/utils/xmlBalanceValidator'

describe('validateXml', () => {
  describe('Given well-formed XML', () => {
    it.each([
      ['empty document', ''],
      ['empty root', '<Root></Root>'],
      ['self-closing root', '<Root/>'],
      ['simple text', '<Root>hello</Root>'],
      ['nested elements', '<Root><a><b>x</b></a><c/></Root>'],
      [
        'declaration + comments + body',
        '<?xml version="1.0"?>\n<!-- intro -->\n<Root><a/></Root>\n',
      ],
      ['CDATA section', '<Root><![CDATA[<not> & "an" <element>]]></Root>'],
      [
        'attributes with quoted angle brackets',
        '<Root><a href="x>y"/><b foo="<bar>"/></Root>',
      ],
      ['namespaced names', '<ns:root xmlns:ns="x"><ns:a/></ns:root>'],
      ['attributes containing greater-than', '<Root><a value="3 > 2"/></Root>'],
    ])('When validating %s, Then it returns', (_label, xml) => {
      expect(() => validateXml(xml)).not.toThrow()
    })
  })

  describe('Given malformed XML', () => {
    it('throws on unclosed tag', () => {
      expect(() => validateXml('<Root><unclosed></Root>')).toThrow(
        MalformedXmlError
      )
    })

    it('throws on tag mismatch', () => {
      expect(() => validateXml('<Root><a></b></Root>')).toThrow(
        MalformedXmlError
      )
    })

    it('throws when an open tag is never closed', () => {
      expect(() => validateXml('<Root><a>')).toThrow(/unclosed tags/)
    })

    it('throws on multiple top-level roots', () => {
      expect(() => validateXml('<A/><B/>')).toThrow(/multiple root/)
    })

    it('throws on unterminated comment', () => {
      expect(() => validateXml('<!-- not closed <Root/>')).toThrow(
        /unterminated comment/
      )
    })

    it('throws on unterminated processing instruction', () => {
      expect(() => validateXml('<?xml version="1.0">')).toThrow(
        /unterminated processing instruction/
      )
    })

    it('throws on unterminated CDATA', () => {
      expect(() => validateXml('<Root><![CDATA[oops</Root>')).toThrow(
        /unterminated CDATA/
      )
    })

    it('throws on unterminated declaration', () => {
      expect(() => validateXml('<!DOCTYPE root')).toThrow(
        /unterminated declaration/
      )
    })

    it('throws on unterminated tag', () => {
      expect(() => validateXml('<Root')).toThrow(/unterminated tag/)
    })

    it('throws on closing tag before opening', () => {
      expect(() => validateXml('</Root>')).toThrow(/tag mismatch/)
    })

    it('throws on a sibling that follows a closed root', () => {
      expect(() => validateXml('<Root></Root><Sibling/>')).toThrow(
        /multiple root/
      )
    })
  })

  describe('Tolerated edge cases', () => {
    it('accepts BOM and surrounding whitespace', () => {
      expect(() => validateXml('﻿  \n<Root/>')).not.toThrow()
    })

    it('accepts XML declarations with attributes', () => {
      expect(() =>
        validateXml('<?xml version="1.0" encoding="UTF-8"?><Root/>')
      ).not.toThrow()
    })

    it('accepts deeply nested elements', () => {
      const depth = 200
      const open = '<a>'.repeat(depth)
      const close = '</a>'.repeat(depth)
      expect(() => validateXml(`<Root>${open}${close}</Root>`)).not.toThrow()
    })

    it('accepts attributes containing forward slashes', () => {
      expect(() =>
        validateXml('<Root><a href="https://x/y"/></Root>')
      ).not.toThrow()
    })
  })
})
