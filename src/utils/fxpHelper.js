'use strict'

const XML_PARSER_OPTION = {
  ignoreAttributes: false,
  ignoreNameSpace: false,
  parseTagValue: false,
  parseNodeValue: false,
  parseAttributeValue: false,
  trimValues: true,
}
const JSON_PARSER_OPTION = {
  ...XML_PARSER_OPTION,
  format: true,
  indentBy: '    ',
}

const asArray = node => {
  return node != null ? (Array.isArray(node) ? node : [node]) : []
}

module.exports.asArray = asArray
module.exports.XML_PARSER_OPTION = XML_PARSER_OPTION
module.exports.JSON_PARSER_OPTION = JSON_PARSER_OPTION
