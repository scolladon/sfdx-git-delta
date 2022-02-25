'use strict'
const StandardHandler = require('./standardHandler')
const { join, normalize, parse } = require('path')
const { readdir } = require('fs').promises
const { pathExists } = require('fs-extra')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')

const STATICRESOURCE_TYPE = 'staticresources'
const elementSrc = {}

class ResourceHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
  }
  async handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return
    const [, srcPath, elementName] = this._parseLine()
    const [targetPath] = `${join(this.config.output, this.line)}`.match(
      new RegExp(
        `.*[/\\\\]${StandardHandler.metadata[this.type].directoryName}`,
        'u'
      )
    )
    await this._buildElementMap(srcPath)

    const matchingFiles = this._buildMatchingFiles(elementName)
    await Promise.all(
      elementSrc[srcPath]
        .filter(
          src =>
            (this.type === STATICRESOURCE_TYPE &&
              src.startsWith(parse(elementName).name)) ||
            matchingFiles.includes(src)
        )
        .map(src =>
          this._copyFiles(
            normalize(join(srcPath, src)),
            normalize(join(targetPath, src))
          )
        )
    )
  }

  async handleDeletion() {
    const [, srcPath, elementName] = this._parseLine()
    const exists = await pathExists(join(srcPath, elementName))
    if (exists) {
      await this.handleModification()
    } else {
      super.handleDeletion()
    }
  }

  _parseLine() {
    return join(this.config.repo, this.line).match(
      new RegExp(
        `(?<path>.*[/\\\\]${
          StandardHandler.metadata[this.type].directoryName
        })[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return StandardHandler.cleanUpPackageMember(parsedPath.name)
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
    if (StandardHandler.metadata[this.type].metaFile) {
      matchingFiles.push(
        `${parsedElementName}.${
          StandardHandler.metadata[this.type].suffix
        }${METAFILE_SUFFIX}`
      )
    }
    return matchingFiles
  }

  async _buildElementMap(srcPath) {
    if (!Object.prototype.hasOwnProperty.call(elementSrc, srcPath)) {
      elementSrc[srcPath] = await readdir(srcPath)
    }
  }
}

module.exports = ResourceHandler
