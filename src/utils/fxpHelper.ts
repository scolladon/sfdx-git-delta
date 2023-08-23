'use strict'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { readPathFromGit } from './fsHelper'
import { XML_HEADER_TAG_END } from './metadataConstants'
import { Config } from '../types/config'

const XML_PARSER_OPTION = {
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
}

export const asArray = (node: string[] | string) => {
  return node != null ? (Array.isArray(node) ? node : [node]) : []
}

export const xml2Json = (xmlContent: string) => {
  const xmlParser = new XMLParser(XML_PARSER_OPTION)
  return xmlParser.parse(xmlContent)
}

export const parseXmlFileToJson = async (line: string, config: Config) => {
  const xmlContent = await readPathFromGit(line, config)
  return xml2Json(xmlContent)
}

export const convertJsonToXml = (jsonContent: any) => {
  const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
  return xmlBuilder
    .build(jsonContent)
    .replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}`)
}

export const ATTRIBUTE_PREFIX = '@_'
