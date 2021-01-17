'use strict'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'
const XML_PARSER_OPTION = {
  ignoreAttributes: false,
  ignoreNameSpace: false,
  arrayMode: true,
}
const JSON_PARSER_OPTION = {
  ...XML_PARSER_OPTION,
  format: true,
  indentBy: '    ',
}
module.exports.XML_HEADER = XML_HEADER
module.exports.XML_PARSER_OPTION = XML_PARSER_OPTION
module.exports.JSON_PARSER_OPTION = JSON_PARSER_OPTION
