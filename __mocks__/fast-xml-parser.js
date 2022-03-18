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

fxp.XMLParser = function () {
  return {
    parse: jest.fn(content => JSON.parse(xml2json[content])),
  }
}

fxp.XMLBuilder = function () {
  return {
    build: jest.fn(content => json2xml[content]),
  }
}

module.exports = fxp
