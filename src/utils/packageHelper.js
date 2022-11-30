'use strict'
const { create } = require('xmlbuilder2')
const xmlConf = { indent: '    ', newline: '\n', prettyPrint: true }
const frLocale = 'fr'

module.exports = class PackageBuilder {
  constructor(config, metadata) {
    this.config = config
    this.metadata = metadata
    this.looseMetadata = [...this.metadata.keys()]
      .filter(type => this.metadata.get(type).content)
      .flatMap(type =>
        this.metadata.get(type).content.map(content => content.xmlName)
      )
  }

  buildPackage(strucDiffPerType) {
    if (!strucDiffPerType) return

    const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele('Package', {
      xmlns: 'http://soap.sforce.com/2006/04/metadata',
    })
    Array.from(strucDiffPerType.keys())
      .filter(
        type => this.metadata.has(type) || this.looseMetadata.includes(type)
      )
      .sort(this._sortTypesWithMetadata)
      .forEach(metadataType =>
        [...strucDiffPerType.get(metadataType)]
          .sort(Intl.Collator(frLocale).compare)
          .reduce((type, member) => {
            type.ele('members').txt(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .txt(this.metadata.get(metadataType)?.xmlName ?? metadataType)
      )
    xml.ele('version').txt(`${this.config.apiVersion}.0`)
    return xml.end(xmlConf)
  }

  _sortTypesWithMetadata = (x, y) => {
    if (x === 'objects') return -1 // @deprecated To remove when the order will not impact the result of the deployment
    const xMeta = this.metadata.get(x)?.xmlName ?? x
    const yMeta = this.metadata.get(y)?.xmlName ?? y
    return new Intl.Collator(frLocale).compare(xMeta, yMeta)
  }
}

const fillPackageWithParameter = params => {
  if (!params.package.has(params.type)) {
    params.package.set(params.type, new Set())
  }
  params.package.get(params.type).add(params.elementName)
}

module.exports.fillPackageWithParameter = fillPackageWithParameter
