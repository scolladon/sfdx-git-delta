'use strict'
const { create } = require('xmlbuilder2')
const xmlConf = { indent: '    ', newline: '\n', prettyPrint: true }
const frLocale = 'fr'
const { OBJECT_XML_NAME } = require('../utils/metadataConstants')

module.exports = class PackageBuilder {
  constructor(config) {
    this.config = config
  }

  buildPackage(strucDiffPerType) {
    if (!strucDiffPerType) return

    const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele('Package', {
      xmlns: 'http://soap.sforce.com/2006/04/metadata',
    })
    Array.from(strucDiffPerType.keys())
      .sort(this._sortTypesWithMetadata)
      .forEach(metadataType =>
        [...strucDiffPerType.get(metadataType)]
          .sort(Intl.Collator(frLocale).compare)
          .reduce((type, member) => {
            type.ele('members').txt(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .txt(metadataType)
      )
    xml.ele('version').txt(`${this.config.apiVersion}.0`)
    return xml.end(xmlConf)
  }

  _sortTypesWithMetadata = (x, y) => {
    if (x === OBJECT_XML_NAME) return -1 // @deprecated To remove when the order will not impact the result of the deployment
    return new Intl.Collator(frLocale).compare(x, y)
  }
}

const fillPackageWithParameter = ({ store, type, member }) => {
  if (!store.has(type)) {
    store.set(type, new Set())
  }
  store.get(type).add(member)
}

const PACKAGE_MEMBER_PATH_SEP = '/'
const cleanUpPackageMember = packageMember => {
  return `${packageMember}`.replace(/\\+/g, PACKAGE_MEMBER_PATH_SEP)
}

module.exports.cleanUpPackageMember = cleanUpPackageMember
module.exports.fillPackageWithParameter = fillPackageWithParameter
