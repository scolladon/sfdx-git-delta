'use strict'

import FlexXMLParser, { type X2jOptions } from '@nodable/flexible-xml-parser'

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

const xmlParser = new FlexXMLParser(XML_PARSER_OPTION)

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

export const ATTRIBUTE_PREFIX = '@_'

export const XML_HEADER_ATTRIBUTE_KEY = '?xml'
