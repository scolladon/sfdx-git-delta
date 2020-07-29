'use strict'
const xmlbuilder = require('xmlbuilder')
const xmlConf = { indent: '    ', newline: '\n', pretty: true }

module.exports = class PackageConstructor {
  constructor(config, metadata) {
    this.config = config
    this.metadata = metadata
  }

  constructPackage(strucDiffPerType) {
    if (!strucDiffPerType) {
      return
    }

    const xml = getXML()
    Object.keys(strucDiffPerType)
      .filter(type => Object.prototype.hasOwnProperty.call(this.metadata, type))
      .forEach(metadataType =>
        [...strucDiffPerType[metadataType]] // transform set to array
          .reduce((type, member) => {
            type.ele('members').t(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .t(this.metadata[metadataType].xmlName)
      )
    xml.ele('version').t(`${this.config.apiVersion}.0`)
    return xml.end(xmlConf)
  }
}

const getXML = () =>
  xmlbuilder
    .create('Package')
    .att('xmlns', 'http://soap.sforce.com/2006/04/metadata')
    .dec('1.0', 'UTF-8')
