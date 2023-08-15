'use strict'
const StandardHandler = require('./standardHandler')
const { join, parse, sep } = require('path')
const { pathExists } = require('../utils/fsHelper')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')
const { cleanUpPackageMember } = require('../utils/packageHelper')
const { DOT } = require('../utils/fsHelper')

class ResourceHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.metadataName = this._getMetadataName()
  }

  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    if (this.line !== this.metadataName && this._parentFolderIsNotTheType()) {
      await this._copy(this.metadataName)
    }
  }

  async handleDeletion() {
    const [, elementPath, elementName] = this._parseLine()
    const exists = await pathExists(join(elementPath, elementName), this.config)
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

  _isProcessable() {
    return true
  }

  _getMetadataName() {
    const resourcePath = []
    for (const pathElement of this.splittedLine) {
      if (resourcePath.slice(-2)[0] === this.type) {
        break
      }
      resourcePath.push(pathElement)
    }
    let lastPathElement = resourcePath[resourcePath.length - 1].split(DOT)
    if (lastPathElement.length > 1) {
      lastPathElement.pop()
    }

    resourcePath[resourcePath.length - 1] = lastPathElement.join(DOT)
    return `${resourcePath.join(sep)}`
  }

  _getMetaTypeFilePath() {
    return `${this.metadataName}.${
      this.metadata.get(this.type).suffix
    }${METAFILE_SUFFIX}`
  }
}

module.exports = ResourceHandler
