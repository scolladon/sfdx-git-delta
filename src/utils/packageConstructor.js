'use strict'
const xmlbuilder = require('xmlbuilder')
const xmlConf = { indent: '    ', newline: '\n', pretty: true }
const mc = require('./metadataConstants')

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
      // Here type is what is in the array
      .filter(
        type =>
          Object.prototype.hasOwnProperty.call(this.metadata, type) ||
          type.startsWith(mc.WAVE_SUB_TYPES_PREFIX)
      )
      .sort()
      // @deprecated To remove when the order will not impact the result of the deployment
      .sort((x, y) => (x === 'objects' ? -1 : x.localeCompare(y)))
      .forEach(metadataType =>
        [...strucDiffPerType[metadataType]] // transform set to array
          .reduce((type, member) => {
            type.ele('members').t(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .t(this.metadata[metadataType]?.xmlName ?? metadataType)
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
