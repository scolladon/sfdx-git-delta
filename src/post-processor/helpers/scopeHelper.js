'use strict'
const { XML_HEADER_TAG_END } = require('../../utils/metadataConstants')
const { scanExtension, readFile } = require('../../utils/fsHelper')
const { outputFile } = require('fs-extra')
const { getMetadataName } = require('../../utils/metadataHelper')
const { XMLParser, XMLBuilder } = require('fast-xml-parser')
const {
  XML_PARSER_OPTION,
  JSON_PARSER_OPTION,
} = require('../../utils/fxpHelper')

class ScopeHelper {
  entryXmlAttribut
  metadataMapping
  metadataType
  metadataFileSuffix
  searchFolder
  manifest

  constructor({
    entryXmlAttribut,
    metadataMapping,
    metadataType,
    metadataFileSuffix,
    context,
  }) {
    this.entryXmlAttribut = entryXmlAttribut
    this.metadataMapping = metadataMapping
    this.metadataType = metadataType
    this.metadataFileSuffix = metadataFileSuffix
    this.searchFolder = context.config.output
    this.manifest = context.diffs.package
    this.xmlParserOption = {
      ...XML_PARSER_OPTION,
      isArray: name =>
        Object.keys(metadataMapping)
          .map(entry => `${entryXmlAttribut}.${entry}`)
          .includes(name),
    }
  }

  async scope() {
    await this._scopeFromManifest()
  }

  async _scopeFromManifest() {
    const iterator = scanExtension(this.searchFolder, this.metadataFileSuffix)

    for await (const metadataPath of iterator) {
      const metadataName = getMetadataName(metadataPath)
      if (this.manifest.get(this.metadataType)?.has(metadataName)) {
        const xmlFile = await readFile(metadataPath)
        const xmlParser = new XMLParser(this.xmlParserOption)
        const jsonContent = xmlParser.parse(xmlFile)

        const metadataContent = jsonContent?.[this.entryXmlAttribut]

        const authorizedKeys = Object.keys(metadataContent).filter(x =>
          Object.keys(this.metadataMapping).includes(x)
        )

        authorizedKeys.forEach(entry => {
          const packageMembers = this.manifest.get(entry)
          metadataContent[entry] = metadataContent[entry].filter(element => {
            const prefix = this.metadataMapping[entry].parentLink
              ? `${metadataName.split('-')[0]}.`
              : ''
            return packageMembers.has(
              prefix + element[this.metadataMapping[entry].key]
            )
          })
        })

        const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
        const xmlContent = xmlBuilder.build(jsonContent)
        await outputFile(
          metadataPath,
          xmlContent.replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}\n`)
        )
      }
    }
  }

  async _scopeFromDiff() {}
}

module.exports = ScopeHelper
