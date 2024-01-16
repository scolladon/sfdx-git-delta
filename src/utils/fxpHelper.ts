'use strict'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { readPathFromGit } from './fsHelper'
import { XML_HEADER_TAG_END } from '../constant/metadataConstants'
import { Config } from '../types/config'

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

export const asArray = (node: string[] | string) => {
  return Array.isArray(node) ? node : [node]
}

export const xml2Json = (xmlContent: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsonContent: any = {}
  if (xmlContent) {
    const xmlParser = new XMLParser(XML_PARSER_OPTION)
    jsonContent = xmlParser.parse(xmlContent)
  }
  return jsonContent
}

export const parseXmlFileToJson = async (line: string, config: Config) => {
  const xmlContent = await readPathFromGit(line, config)
  return xml2Json(xmlContent)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const convertJsonToXml = (jsonContent: any) => {
  const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
  return xmlBuilder
    .build(jsonContent)
    .replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}`)
}

export const ATTRIBUTE_PREFIX = '@_'
