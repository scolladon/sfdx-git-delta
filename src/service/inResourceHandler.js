'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fs = require('fs')
const mc = require('../utils/metadataConstants')

const elementSrc = {}

class ResourceHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
  }
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return
    const [, srcPath, elementName] = this._parseLine()
    const [targetPath] = `${path.join(this.config.output, this.line)}`.match(
      new RegExp(
        `.*[/\\\\]${StandardHandler.metadata[this.type].directoryName}`,
        'u'
      )
    )

    const parsedElementName = path.parse(elementName)
    if (!Object.prototype.hasOwnProperty.call(elementSrc, srcPath)) {
      elementSrc[srcPath] = fs.readdirSync(srcPath)
    }

    elementSrc[srcPath]
      .filter(src => path.parse(src).name === parsedElementName.name)
      .forEach(src =>
        this._copyFiles(
          path.normalize(path.join(srcPath, src)),
          path.normalize(path.join(targetPath, src))
        )
      )
  }

  handleDeletion() {
    const [, srcPath, elementName] = this._parseLine()
    if (fs.existsSync(path.join(srcPath, elementName))) {
      this.handleModification(this)
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
}

module.exports = ResourceHandler
