'use strict'
const fileGitDiff = require('../utils/fileGitDiff')
const gc = require('../utils/gitConstants')
const StandardHandler = require('./standardHandler')
const fs = require('fs')
const fse = require('fs-extra')
const os = require('os')
const path = require('path')
const xml2js = require('xml2js')

const FULLNAME = 'fullName'
const FULLNAME_XML_TAG = new RegExp(`<${FULLNAME}>(.*)</${FULLNAME}>`)
const XML_TAG = new RegExp('<(.*)>')

class InFileHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.xmlObjectToPackageType = Object.keys(this.metadata)
      .filter(meta => !!this.metadata[meta].xmlTag)
      .reduce((acc, meta) => {
        acc[this.metadata[meta].xmlTag] = this.metadata[meta]
        return acc
      }, {})
  }

  handleAddition() {
    super.handleAddition()
    this.promises.push(this._fillPackageFromFile(this.diffs.package))
  }

  handleDeletion() {
    super.handleDeletion()
    this.promises.push(this._handleInFile())
  }

  handleModification() {
    this.promises.push(
      this._handleInFile().then(toAdd => this._handleFileWriting(toAdd))
    )
  }

  _handleFileWriting(toAdd) {
    return this._parseFile().then(result => {
      const metadataContent = Object.values(result.fileContent)[0]
      result.authorizedKeys.forEach(
        type =>
          (metadataContent[type] = metadataContent[type].filter(
            elem => toAdd[type] && toAdd[type].has(elem.fullName[0])
          ))
      )
      const builder = new xml2js.Builder()
      fse.outputFileSync(
        path.join(this.config.output, this.line),
        builder.buildObject(result)
      )
    })
  }

  _handleInFile() {
    return fileGitDiff(this.line, this.config).then(diffContent => {
      const toRemove = {},
        toAdd = {}
      let potentialType, type, fullName
      diffContent.split(os.EOL).forEach(line => {
        if (FULLNAME_XML_TAG.test(line)) {
          fullName = line.match(FULLNAME_XML_TAG)[1]
          type = potentialType
        } else if (XML_TAG.test(line)) {
          potentialType = line.match(XML_TAG)[1]
        }
        if (!type || !fullName) return
        if (line.startsWith(gc.SUPPRESSION_TAG) && line.includes(FULLNAME)) {
          toRemove[type] = toRemove[type] || new Set()
          toRemove[type].add(fullName)
        } else if (line.startsWith(gc.ADDITION_TAG)) {
          toAdd[type] = toAdd[type] || new Set()
          toAdd[type].add(fullName)
        }
        type = fullName = null
      })
      this._treatInFileResult(toRemove, toAdd)
      return toAdd
    })
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
    const xmlData = fs.readFileSync(path.join(this.config.repo, this.line))
    const parser = new xml2js.Parser()
    return parser.parseStringPromise(xmlData).then(result => {
      const authorizedKeys = Object.keys(Object.values(result)[0]).filter(x =>
        Object.prototype.hasOwnProperty.call(this.xmlObjectToPackageType, x)
      )
      return {
        authorizedKeys: authorizedKeys,
        fileContent: result,
      }
    })
  }

  _fillPackageFromFile(packageObject) {
    return this._parseFile().then(result => {
      const metadataContent = Object.values(result.fileContent)[0]

      result.authorizedKeys.forEach(type =>
        metadataContent[type].forEach(value =>
          this._fillPackageFromDiff(packageObject, type, value.fullName[0])
        )
      )
    })
  }

  _fillPackageFromDiff(packageObject, type, value) {
    const _type = type == 'labels' ? 'label' : type
    const elementFullName = `${(_type !== 'label'
      ? `${path.basename(this.line).split('.')[0]}.`
      : '') + value}`

    packageObject[_type] = packageObject[_type] || new Set()
    packageObject[_type].add(elementFullName)
  }
}

module.exports = InFileHandler
