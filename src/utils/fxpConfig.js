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

module.exports.XML_PARSER_OPTION = XML_PARSER_OPTION
module.exports.JSON_PARSER_OPTION = JSON_PARSER_OPTION
