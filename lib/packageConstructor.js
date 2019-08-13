'use strict'
const xmlbuilder = require('xmlbuilder')
const metadata = require('./metadata/metadata')('directoryName')
const xmlConf = { indent: '    ', newline: '\n', pretty: true }

module.exports = class PackageConstructor {
  constructor(config) {
    this.config = config
  }

  constructPackage(strucDiffPerType) {
    if (!strucDiffPerType) {
      return Promise.resolve()
    }
    return new Promise(resolve => {
      const xml = getXML()
      Object.keys(strucDiffPerType)
        .filter(type => Object.prototype.hasOwnProperty.call(metadata, type))
        .forEach(metadataType =>
          strucDiffPerType[metadataType]
            .reduce((type, member) => {
              type.ele('members').t(member)
              return type
            }, xml.ele('types'))
            .ele('name')
            .t(metadata[metadataType].xmlName)
        )
      xml.ele('version').t(this.config.apiVersion)
      resolve(xml.end(xmlConf))
    })
  }
}

const getXML = () =>
  xmlbuilder
    .create('Package')
    .att('xmlns', 'http://soap.sforce.com/2006/04/metadata')
    .dec('1.0', 'UTF-8')
