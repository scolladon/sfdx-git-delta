'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const { readdir } = require('fs').promises
const fse = require('fs-extra')
const mc = require('../utils/metadataConstants')

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
    const [targetPath] = `${path.join(this.config.output, this.line)}`.match(
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
              src.startsWith(path.parse(elementName).name)) ||
            matchingFiles.includes(src)
        )
        .map(src =>
          this._copyFiles(
            path.normalize(path.join(srcPath, src)),
            path.normalize(path.join(targetPath, src))
          )
        )
    )
  }

  async handleDeletion() {
    const [, srcPath, elementName] = this._parseLine()
    const exists = await fse.pathExists(path.join(srcPath, elementName))
    if (exists) {
      await this.handleModification(this)
    } else {
      super.handleDeletion()
    }
  }

  _parseLine() {
    return path
      .join(this.config.repo, this.line)
      .match(
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
    return path.parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(mc.META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  _buildMatchingFiles(elementName) {
    const parsedElementName = path.parse(elementName).name
    const matchingFiles = [parsedElementName]
    if (StandardHandler.metadata[this.type].metaFile) {
      matchingFiles.push(
        `${parsedElementName}.${StandardHandler.metadata[this.type].suffix}${
          mc.METAFILE_SUFFIX
        }`
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
