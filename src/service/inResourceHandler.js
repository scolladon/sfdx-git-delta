'use strict'
const StandardHandler = require('./standardHandler')
const { join, parse } = require('path')
const { pathExists, readDir } = require('../utils/fsHelper')
const { META_REGEX } = require('../utils/metadataConstants')
const { sep } = require('path')
const { cleanUpPackageMember } = require('../utils/packageHelper')

const STATICRESOURCE_TYPE = 'staticresources'
const elementSrc = new Map()

class ResourceHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
  }

  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    const [, srcPath, elementFile] = this._parseLine()
    await this._buildElementMap(srcPath)
    const matchingFiles = this._buildMatchingFiles(elementFile)
    const elementName = parse(elementFile).name
    await Promise.all(
      elementSrc
        .get(srcPath)
        .filter(
          src =>
            (this.type === STATICRESOURCE_TYPE &&
              src.startsWith(elementName)) ||
            matchingFiles.includes(src)
        )
        .map(src => this._copyWithMetaFile(join(srcPath, src)))
    )
  }

  async handleDeletion() {
    const [, srcPath, elementName] = this._parseLine()
    const exists = await pathExists(join(srcPath, elementName), this.config)
    if (exists) {
      await this.handleModification()
    } else {
      super.handleDeletion()
    }
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return cleanUpPackageMember(parsedPath.name)
  }

  _getParsedPath() {
    return parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  _buildMatchingFiles(elementName) {
    const parsedElementName = parse(elementName).name
    const matchingFiles = [parsedElementName]
    if (this.metadata.get(this.type).metaFile) {
      matchingFiles.push(this._getRelativeMetadataXmlFileName(elementName))
    }
    return matchingFiles
  }

  async _buildElementMap(srcPath) {
    if (!elementSrc.has(srcPath)) {
      const dirContent = await readDir(srcPath, this.config)
      elementSrc.set(
        srcPath,
        dirContent.map(f => f.replace(/\/$/, ''))
      )
    }
  }

  _isProcessable() {
    const parsedLine = parse(this.line)
    const parentFolder = parsedLine.dir.split(sep).pop()

    return (
      super._isProcessable() ||
      parentFolder !== this.type ||
      !parsedLine.name.startsWith('.')
    )
  }
}

module.exports = ResourceHandler
