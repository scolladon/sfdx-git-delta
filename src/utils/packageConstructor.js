'use strict'
const xmlbuilder = require('xmlbuilder')
const xmlConf = { indent: '    ', newline: '\n', pretty: true }

module.exports = class PackageConstructor {
  constructor(config, metadata) {
    this.config = config
    this.metadata = metadata
    this.looseMetadata = Object.keys(this.metadata)
      .filter(type => this.metadata[type].content)
      .flatMap(type =>
        this.metadata[type].content.map(content => content.xmlName)
      )
  }

  constructPackage(strucDiffPerType) {
    if (!strucDiffPerType) {
      return
    }

    const xml = getXML()
    const sortTypes = sortTypesWithMetadata(this.metadata)
    Object.keys(strucDiffPerType)
      .filter(
        type =>
          Object.hasOwn(this.metadata, type) ||
          this.looseMetadata.includes(type)
      )
      .sort(sortTypes)
      .forEach(metadataType =>
        [...strucDiffPerType[metadataType]] // transform set to array
          .sort()
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

const sortTypesWithMetadata = metadata => (x, y) => {
  if (x === 'objects') return -1 // @deprecated To remove when the order will not impact the result of the deployment
  const xMeta = metadata[x]?.xmlName ?? x
  const yMeta = metadata[y]?.xmlName ?? y
  return xMeta.localeCompare(yMeta)
}

const getXML = () =>
  xmlbuilder
    .create('Package')
    .att('xmlns', 'http://soap.sforce.com/2006/04/metadata')
    .dec('1.0', 'UTF-8')
