'use strict'
const StandardHandler = require('./standardHandler')
const { join, parse } = require('path')
const { pathExists, readDir } = require('../utils/fsHelper')
const { META_REGEX, METAFILE_SUFFIX } = require('../utils/metadataConstants')
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
    const [, srcPath, elementName] = this._parseLine()
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
      const dirContent = await readDir(srcPath, this.config)
      elementSrc.set(
        srcPath,
        dirContent.map(f => f.replace(/\/$/, ''))
      )
    }
  }
}

module.exports = ResourceHandler
