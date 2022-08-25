'use strict'
const fxp = jest.genMockFromModule('fast-xml-parser')

let json2xml = new Map()
let xml2json = new Map()
fxp.__setMockContent = contents => {
  json2xml = new Map()
  xml2json = new Map()
  for (const content in contents) {
    json2xml.set(contents[content], content)
    xml2json.set(content, contents[content])
  }
}

const mockParse = jest.fn(content => JSON.parse(xml2json.get(content)))
fxp.XMLParser = function () {
  return {
    parse: mockParse,
  }
}

fxp.XMLBuilder = function () {
  return {
    build: jest.fn(content => json2xml.get(content)),
  }
}

module.exports = fxp
module.exports.mockParse = mockParse
