'use strict'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'

import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'

import { readPathFromGit } from './fsHelper.js'

/**
 * Represents parsed XML content as a JSON object.
 * Used throughout the codebase for XML metadata manipulation.
 */
// biome-ignore lint/suspicious/noExplicitAny: XML content has dynamic structure from Salesforce metadata
export type XmlContent = Record<string, any>

const XML_PARSER_OPTION = {
  commentPropName: '#comment',
  ignoreAttributes: false,
  ignoreNameSpace: false,
  parseTagValue: false,
  parseNodeValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
}
const JSON_PARSER_OPTION = {
  ...XML_PARSER_OPTION,
  format: true,
  indentBy: '    ',
  suppressBooleanAttributes: false,
  suppressEmptyNode: false,
}

export const xml2Json = (xmlContent: string): XmlContent => {
  let jsonContent: XmlContent = {}
  if (xmlContent) {
    const xmlParser = new XMLParser(XML_PARSER_OPTION)
    jsonContent = xmlParser.parse(xmlContent)
  }
  return jsonContent
}

export const parseXmlFileToJson = async (
  forRef: FileGitRef,
  config: Config
): Promise<XmlContent> => {
  const xmlContent = await readPathFromGit(forRef, config)
  return xml2Json(xmlContent)
}

export const convertJsonToXml = (jsonContent: XmlContent | unknown): string => {
  const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
  return xmlBuilder.build(jsonContent)
}

export const ATTRIBUTE_PREFIX = '@_'

export const XML_HEADER_ATTRIBUTE_KEY = '?xml'
