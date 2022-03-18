'use strict'
const StandardHandler = require('./standardHandler')
const { join, normalize, parse } = require('path')
const { readdir } = require('fs').promises
const { pathExists } = require('fs-extra')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')

const STATICRESOURCE_TYPE = 'staticresources'
const elementSrc = new Map()

class ResourceHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
  }
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    const [, srcPath, elementName] = this._parseLine()
    const [targetPath] = `${join(this.config.output, this.line)}`.match(
      new RegExp(
        `.*[/\\\\]${StandardHandler.metadata.get(this.type).directoryName}`,
        'u'
      )
    )
    await this._buildElementMap(srcPath)

    const matchingFiles = this._buildMatchingFiles(elementName)
    await Promise.all(
      elementSrc
        .get(srcPath)
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
          StandardHandler.metadata.get(this.type).directoryName
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
    if (StandardHandler.metadata.get(this.type).metaFile) {
      matchingFiles.push(
        `${parsedElementName}.${
          StandardHandler.metadata.get(this.type).suffix
        }${METAFILE_SUFFIX}`
      )
    }
    return matchingFiles
  }

  async _buildElementMap(srcPath) {
    if (!elementSrc.has(srcPath)) {
      const dirContent = await readdir(srcPath)
      elementSrc.set(srcPath, dirContent)
    }
  }
}

module.exports = ResourceHandler
