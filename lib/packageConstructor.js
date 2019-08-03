'use strict'
const xmlbuilder = require('xmlbuilder')
const metadata = require('./metadata/v46')('directoryName')

module.exports = class PackageConstructor {
  constructor(config) {
    this.config = config
  }

  constructPackage(strucDiffPerType) {
    if (!strucDiffPerType) {
      return Promise.resolve()
    }

    return new Promise(resolve => {
      const xml = xmlbuilder
        .create('Package')
        .att('xmlns', 'http://soap.sforce.com/2006/04/metadata')
        .dec('1.0', 'UTF-8')

      Object.keys(strucDiffPerType)
        .filter(type => Object.prototype.hasOwnProperty.call(metadata, type))
        .forEach(metadataType => {
          const type = xml.ele('types')

          strucDiffPerType[metadataType].forEach(member => {
            type.ele('members').t(member)
          })
          type.ele('name').t(metadata[metadataType].xmlName)
        })
      xml.ele('version').t(this.config.apiVersion)
      resolve(
        xml.end({
          indent: '    ',
          newline: '\n',
          pretty: true,
        })
      )
    })
  }
}
