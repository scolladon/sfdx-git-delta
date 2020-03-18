'use strict'
const xml2js = jest.genMockFromModule('xml2js')

let json2xml = {}
let xml2json = {}
xml2js.__setMockContent = contents => {
  json2xml = {}
  xml2json = {}
  for (const content in contents) {
    json2xml[contents[content]] = content
    xml2json[content] = contents[content]
  }
}

xml2js.Parser = class Parser {
  parseStringPromise(content) {
    return new Promise(resolve => resolve(xml2json[content]))
  }
}

xml2js.Builder = class Builder {
  buildObject(content) {
    return json2xml[content]
  }
}

module.exports = xml2js
