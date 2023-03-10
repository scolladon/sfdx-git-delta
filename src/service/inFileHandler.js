'use strict'
const {
  LABEL_DIRECTORY_NAME,
  XML_HEADER_TAG_END,
} = require('../utils/metadataConstants')
const { readPathFromGit } = require('../utils/fsHelper')
const StandardHandler = require('./standardHandler')
const { outputFile } = require('fs-extra')
const { basename, join } = require('path')
const { XMLBuilder, XMLParser } = require('fast-xml-parser')
const { asArray } = require('../utils/fxpHelper')
const { XML_PARSER_OPTION, JSON_PARSER_OPTION } = require('../utils/fxpHelper')
const { treatPathSep } = require('../utils/childProcessUtils')
const { isEqual } = require('lodash')

const parseFile = async (line, config) => {
  const file = await readPathFromGit(line, config)
  const xmlParser = new XMLParser(XML_PARSER_OPTION)
  const result = xmlParser.parse(file)

  const authorizedKeys = Object.values(result)
    .flatMap(tag => Object.keys(tag))
    .filter(tag => InFileHandler.xmlObjectToPackageType.has(tag))
  return {
    authorizedKeys: authorizedKeys,
    fileContent: result,
  }
}

class InFileHandler extends StandardHandler {
  static xmlObjectToPackageType

  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.parentMetadata = StandardHandler.metadata.get(this.type)
    this.customLabelElementName = `${basename(this.line).split('.')[0]}.`
    InFileHandler.xmlObjectToPackageType =
      InFileHandler.xmlObjectToPackageType ??
      [...StandardHandler.metadata.keys()]
        .filter(meta => StandardHandler.metadata.get(meta)?.xmlTag)
        .reduce(
          (acc, meta) =>
            acc.set(
              StandardHandler.metadata.get(meta).xmlTag,
              StandardHandler.metadata.get(meta)
            ),
          new Map()
        )
  }

  async handleAddition() {
    await super.handleAddition()
    const toAdd = await this._handleInDiff()

    if (!this.config.generateDelta) return
    await this._handleFileWriting(toAdd)
  }

  async handleDeletion() {
    await this._handleInDiff()
  }

  async handleModification() {
    await this.handleAddition()
  }

  async _handleFileWriting(toAdd) {
    const result = await parseFile(this.line, this.config)
    const metadataContent = Object.values(result.fileContent)[1]

    result.authorizedKeys.forEach(subType => {
      const meta = asArray(metadataContent[subType])
      metadataContent[subType] = meta.filter(elem =>
        toAdd
          .get(InFileHandler.xmlObjectToPackageType.get(subType).directoryName)
          ?.has(elem.fullName)
      )
    })
    const xmlBuilder = new XMLBuilder(JSON_PARSER_OPTION)
    const xmlContent = xmlBuilder.build(result.fileContent)
    await outputFile(
      join(this.config.output, treatPathSep(this.line)),
      xmlContent.replace(XML_HEADER_TAG_END, `${XML_HEADER_TAG_END}\n`)
    )
  }

  async _handleInDiff() {
    const data = {
      toDel: new Map(),
      toAdd: new Map(),
      potentialType: null,
      subType: null,
      fullName: null,
    }

    const toFile = await parseFile(this.line, this.config)
    const fromFile = await parseFile(this.line, {
      ...this.config,
      to: this.config.from,
    })

    const toFileContent = Object.values(toFile.fileContent)[1]
    const fromFileContent = Object.values(fromFile.fileContent)[1]

    // Compute added
    toFile.authorizedKeys.forEach(subType => {
      const childType = `${this.parentMetadata.directoryName}.${subType}`
      const toMeta = asArray(toFileContent?.[subType])
      const fromMeta = asArray(fromFileContent?.[subType])
      toMeta
        .filter(elem => !fromMeta.some(f => f.fullName === elem.fullName))
        .forEach(elem => {
          if (!data.toAdd.has(childType)) {
            data.toAdd.set(childType, new Set())
          }
          data.toAdd.get(childType).add(elem.fullName)
        })
    })

    // Compute deleted (added inverted)
    fromFile.authorizedKeys.forEach(subType => {
      const childType = `${this.parentMetadata.directoryName}.${subType}`
      const toMeta = asArray(toFileContent?.[subType])
      const fromMeta = asArray(fromFileContent?.[subType])
      fromMeta
        .filter(elem => !toMeta.some(f => f.fullName === elem.fullName))
        .forEach(elem => {
          if (!data.toDel.has(childType)) {
            data.toDel.set(childType, new Set())
          }
          data.toDel.get(childType).add(elem.fullName)
        })
    })

    // Compute changed (same fullname different content)
    toFile.authorizedKeys.forEach(subType => {
      const childType = `${this.parentMetadata.directoryName}.${subType}`
      const toMeta = asArray(toFileContent?.[subType])
      const fromMeta = asArray(fromFileContent?.[subType])
      toMeta
        .filter(elem => {
          const fromElem = fromMeta.find(f => f.fullName === elem.fullName)
          return !isEqual(fromElem, elem)
        })
        .forEach(elem => {
          if (!data.toAdd.has(childType)) {
            data.toAdd.set(childType, new Set())
          }
          data.toAdd.get(childType).add(elem.fullName)
        })
    })

    this._treatInFileResult(data.toDel, data.toAdd)
    return data.toAdd
  }

  _treatInFileResult(toRemove, toAdd) {
    for (const [type, members] of toRemove) {
      ;[...members]
        .filter(elem => !toAdd.get(type)?.has(elem))
        .forEach(fullName =>
          this._fillPackageFromDiff(
            this.diffs.destructiveChanges,
            type,
            fullName
          )
        )
    }
    for (const [type, members] of toAdd) {
      for (let fullName of members) {
        this._fillPackageFromDiff(this.diffs.package, type, fullName)
      }
    }
  }

  _fillPackageFromDiff(packageObject, subType, value) {
    const elementFullName = StandardHandler.cleanUpPackageMember(
      `${
        (subType !== LABEL_DIRECTORY_NAME ? this.customLabelElementName : '') +
        value
      }`
    )

    if (!packageObject.has(subType)) {
      packageObject.set(subType, new Set())
    }
    packageObject.get(subType).add(elementFullName)
  }
}

module.exports = InFileHandler
