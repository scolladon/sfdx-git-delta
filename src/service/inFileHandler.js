'use strict'
const fileGitDiff = require('../utils/fileGitDiff')
const gc = require('../utils/gitConstants')
const mc = require('../utils/metadataConstants')
const StandardHandler = require('./standardHandler')
const fse = require('fs-extra')
const os = require('os')
const path = require('path')
const fxp = require('fast-xml-parser')

const FULLNAME = 'fullName'
const FULLNAME_XML_TAG = new RegExp(`<${FULLNAME}>(.*)</${FULLNAME}>`)
const XML_TAG = new RegExp(`^[${gc.MINUS}${gc.PLUS}]?\\s*<([^(/><.)]+)>\\s*$`)
const XML_HEADER = '<?xml version="1.0" encoding="utf-8"?>\n'
const XML_PARSER_OPTION = {
  ignoreAttributes: false,
  ignoreNameSpace: false,
}
const JSON_PARSER_OPTION = {
  ...XML_PARSER_OPTION,
  format: true,
  indentBy: '    ',
}

class InFileHandler extends StandardHandler {
  static xmlObjectToPackageType

  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.parentMetadata = StandardHandler.metadata[this.type]
    InFileHandler.xmlObjectToPackageType =
      InFileHandler.xmlObjectToPackageType ??
      Object.keys(StandardHandler.metadata)
        .filter(meta => !!StandardHandler.metadata[meta].xmlTag)
        .reduce((acc, meta) => {
          acc[StandardHandler.metadata[meta].xmlTag] =
            StandardHandler.metadata[meta]

          return acc
        }, {})
  }

  handleAddition() {
    super.handleAddition()
    const toAdd = this._handleInDiff()
    this._handleFileWriting(toAdd)
  }

  handleDeletion() {
    this._handleInDiff()
  }

  handleModification() {
    super.handleAddition()
    const toAdd = this._handleInDiff()
    this._handleFileWriting(toAdd)
  }

  _handleFileWriting(toAdd) {
    if (!this.config.generateDelta) return
    const result = this._parseFile()
    const metadataContent = Object.values(result.fileContent)[0]

    result.authorizedKeys.forEach(subType => {
      const meta = Array.isArray(metadataContent[subType])
        ? metadataContent[subType]
        : [metadataContent[subType]]
      metadataContent[subType] = meta.filter(elem =>
        toAdd[InFileHandler.xmlObjectToPackageType[subType].directoryName]?.has(
          elem.fullName
        )
      )
    })
    const xmlBuilder = new fxp.j2xParser(JSON_PARSER_OPTION)
    const xmlContent = XML_HEADER + xmlBuilder.parse(result.fileContent)
    fse.outputFileSync(path.join(this.config.output, this.line), xmlContent)
  }

  _handleInDiff() {
    const diffContent = fileGitDiff(this.line, this.config),
      toDel = {},
      toAdd = {}
    let potentialType, subType, fullName
    diffContent.split(os.EOL).forEach(line => {
      if (FULLNAME_XML_TAG.test(line)) {
        fullName = line.match(FULLNAME_XML_TAG)[1]
        subType = `${this.parentMetadata.directoryName}.${potentialType}`
      }
      const xmlTagMatchResult = line.match(XML_TAG)
      if (this._matchAllowedXmlTag(xmlTagMatchResult)) {
        potentialType = xmlTagMatchResult[1]
        fullName = null
      }
      if (!subType || !fullName) return
      if (line.startsWith(gc.MINUS) && line.includes(FULLNAME)) {
        toDel[subType] = toDel[subType]?.add(fullName) ?? new Set([fullName])
        subType = fullName = null
      } else if (line.startsWith(gc.PLUS) || line.startsWith(gc.MINUS)) {
        toAdd[subType] = toAdd[subType]?.add(fullName) ?? new Set([fullName])
      }
    })
    this._treatInFileResult(toDel, toAdd)
    return toAdd
  }

  _matchAllowedXmlTag(matchResult) {
    return (
      !!matchResult &&
      !!matchResult[1] &&
      Object.prototype.hasOwnProperty.call(
        InFileHandler.xmlObjectToPackageType,
        matchResult[1]
      )
    )
  }

  _treatInFileResult(toRemove, toAdd) {
    Object.keys(toRemove).forEach(type =>
      [...toRemove[type]]
        .filter(elem => !toAdd[type] || !toAdd[type].has(elem))
        .forEach(fullName =>
          this._fillPackageFromDiff(
            this.diffs.destructiveChanges,
            type,
            fullName
          )
        )
    )
    Object.keys(toAdd).forEach(type =>
      toAdd[type].forEach(fullName =>
        this._fillPackageFromDiff(this.diffs.package, type, fullName)
      )
    )
  }

  _parseFile() {
    const xmlContent = this._readFileSync()
    const xmlValidation = fxp.validate(xmlContent)
    if (xmlValidation !== true) {
      throw new Error(xmlValidation?.err?.msg)
    }
    const result = fxp.parse(xmlContent, XML_PARSER_OPTION)

    const authorizedKeys = Object.keys(Object.values(result)[0]).filter(tag =>
      Object.prototype.hasOwnProperty.call(
        InFileHandler.xmlObjectToPackageType,
        tag
      )
    )
    return {
      authorizedKeys: authorizedKeys,
      fileContent: result,
    }
  }

  _fillPackage(packageObject) {
    if (this.type !== mc.LABEL_EXTENSION) {
      super._fillPackage(packageObject)
    }
  }

  _fillPackageFromDiff(packageObject, subType, value) {
    const elementFullName = `${
      (subType !== mc.LABEL_DIRECTORY_NAME
        ? `${path.basename(this.line).split('.')[0]}.`
        : '') + value
    }`

    packageObject[subType] = packageObject[subType] ?? new Set()
    packageObject[subType].add(
      StandardHandler.cleanUpPackageMember(elementFullName)
    )
  }
}

module.exports = InFileHandler
