'use strict'

const { XMLBuilder, XMLParser } = require('fast-xml-parser')
const { readPathFromGit } = require('./fsHelper')
const { XML_HEADER_TAG_END } = require('./metadataConstants')

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

const asArray = node => {
  return node != null ? (Array.isArray(node) ? node : [node]) : []
}

const xml2Json = xmlContent => {
  const xmlParser = new XMLParser(XML_PARSER_OPTION)
  return xmlParser.parse(xmlContent)
}

const parseXmlFileToJson = async (line, config) => {
  const xmlContent = await readPathFromGit(line, config)
  return xml2Json(xmlContent)
}

const convertJsonToXml = jsonContent => {
  const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
  return xmlBuilder
    .build(jsonContent)
    .replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}`)
}

module.exports.asArray = asArray
module.exports.convertJsonToXml = convertJsonToXml
module.exports.parseXmlFileToJson = parseXmlFileToJson
module.exports.xml2Json = xml2Json
module.exports.ATTRIBUTE_PREFIX = '@_'
