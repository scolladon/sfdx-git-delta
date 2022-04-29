'use strict'
const { create } = require('xmlbuilder2')
const xmlConf = { indent: '    ', newline: '\n', prettyPrint: true }
const frLocale = 'fr'

module.exports = class PackageConstructor {
  constructor(config, metadata) {
    this.config = config
    this.metadata = metadata
    const metadataKeys = [...this.metadata.keys()]
    this.inFolderMetadataTypes = metadataKeys.filter(
      type => this.metadata.get(type).inFolder
    )
    this.looseMetadata = metadataKeys
      .filter(type => this.metadata.get(type).content)
      .flatMap(type =>
        this.metadata.get(type).content.map(content => content.xmlName)
      )
  }

  constructPackage(strucDiffPerType) {
    if (!strucDiffPerType) return

    const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele('Package', {
      xmlns: 'http://soap.sforce.com/2006/04/metadata',
    })
    const sortTypes = sortTypesWithMetadata(this.metadata)

    Array.from(strucDiffPerType.keys())
      .filter(
        type => this.metadata.has(type) || this.looseMetadata.includes(type)
      )
      .sort(sortTypes)
      .forEach(metadataType => {
        const addedFolderName = new Map()
        return [...strucDiffPerType.get(metadataType)]
          .sort(Intl.Collator(frLocale).compare)
          .reduce((type, member) => {
            if (this.inFolderMetadataTypes.includes(metadataType)) {
              const folderName = member.substr(0, member.indexOf('/'))
              if (!addedFolderName.has(folderName)) {
                type.ele('members').txt(folderName)
                addedFolderName.set(folderName)
              }
            }

            type.ele('members').txt(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .txt(this.metadata.get(metadataType)?.xmlName ?? metadataType)
      })
    xml.ele('version').txt(`${this.config.apiVersion}.0`)
    return xml.end(xmlConf)
  }
}

const sortTypesWithMetadata = metadata => (x, y) => {
  if (x === 'objects') return -1 // @deprecated To remove when the order will not impact the result of the deployment
  const xMeta = metadata.get(x)?.xmlName ?? x
  const yMeta = metadata.get(y)?.xmlName ?? y
  return new Intl.Collator(frLocale).compare(xMeta, yMeta)
}
