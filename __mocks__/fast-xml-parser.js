'use strict'
const fxp = jest.genMockFromModule('fast-xml-parser')

let json2xml = {}
let xml2json = {}
fxp.__setMockContent = contents => {
  json2xml = {}
  xml2json = {}
  for (const content in contents) {
    json2xml[contents[content]] = content
    xml2json[content] = contents[content]
  }
}

fxp.validate = content => {
  return Object.prototype.hasOwnProperty.call(xml2json, content)
}

fxp.parse = content => {
  return JSON.parse(xml2json[content])
}

fxp.j2xParser = class j2xParser {
  parse(content) {
    return json2xml[content]
  }
}

module.exports = fxp
