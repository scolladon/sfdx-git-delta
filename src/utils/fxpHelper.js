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
  arrayMode: true,
}
const JSON_PARSER_OPTION = {
  ...XML_PARSER_OPTION,
  format: true,
  indentBy: '    ',
}

const asArray = node => {
  return node != null ? (Array.isArray(node) ? node : [node]) : []
}

const parseXmlFileToJson = async (line, config, options) => {
  const parserOption = {
    ...XML_PARSER_OPTION,
    ...options,
  }
  const xmlContent = await readPathFromGit(line, config)
  const xmlParser = new XMLParser(parserOption)
  return xmlParser.parse(xmlContent)
}

const convertJsonToXml = (jsonContent, options) => {
  const builderOption = {
    ...JSON_PARSER_OPTION,
    ...options,
  }
  const xmlBuilder = new XMLBuilder(builderOption)
  return xmlBuilder
    .build(jsonContent)
    .replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}`)
}

module.exports.asArray = asArray
module.exports.convertJsonToXml = convertJsonToXml
module.exports.parseXmlFileToJson = parseXmlFileToJson
