'use strict'

import FlexXMLParser, { type X2jOptions } from '@nodable/flexible-xml-parser'
import { XMLBuilder } from 'fast-xml-parser'

import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'

import { readPathFromGit } from './fsHelper.js'

export type XmlContent = Record<string, unknown>

const XML_PARSER_OPTION: X2jOptions = {
  skip: {
    attributes: false,
    nsPrefix: false,
    comment: false,
    declaration: false,
  },
  nameFor: {
    comment: '#comment',
  },
  attributes: {
    prefix: '@_',
    valueParsers: [] as unknown[],
  },
  tags: {
    valueParsers: ['trim'] as unknown[],
  },
} as X2jOptions
// processEntities MUST stay false: FlexXMLParser keeps XML entities raw in the
// parsed JSON (e.g. "a &amp; b" → "a &amp; b", not "a & b"). Flipping this to
// true makes XMLBuilder re-encode the already-raw entities, producing
// double-encoded output like "a &amp;amp; b". Parser-builder symmetry matters.
const JSON_PARSER_OPTION = {
  commentPropName: '#comment',
  ignoreAttributes: false,
  ignoreNameSpace: false,
  parseTagValue: false,
  parseNodeValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
  format: true,
  indentBy: '    ',
  suppressBooleanAttributes: false,
  suppressEmptyNode: false,
}

const xmlParser = new FlexXMLParser(XML_PARSER_OPTION)
const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)

export const xml2Json = (xmlContent: string): XmlContent => {
  if (!xmlContent) {
    return {}
  }
  try {
    return xmlParser.parse(xmlContent) as XmlContent
  } catch {
    return {}
  }
}

export const parseXmlFileToJson = async (
  forRef: FileGitRef,
  config: Config
): Promise<XmlContent> => {
  const xmlContent = await readPathFromGit(forRef, config)
  return xml2Json(xmlContent)
}

export const convertJsonToXml = (jsonContent: XmlContent | unknown): string =>
  xmlBuilder.build(jsonContent)

export const ATTRIBUTE_PREFIX = '@_'

export const XML_HEADER_ATTRIBUTE_KEY = '?xml'
