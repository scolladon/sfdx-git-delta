'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')

const elementSrc = {}

class ResourceHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.elementRegex = new RegExp(
      `(?<path>.*[/\\\\]${
        this.metadata[this.type].directoryName
      })[/\\\\](?<name>[^/\\\\]*)+`,
      'u'
    )
  }
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return
    const [, srcPath, elementName] = path
      .join(this.config.repo, this.line)
      .match(this.elementRegex)
    const [targetPath] = `${path.join(this.config.output, this.line)}`.match(
      new RegExp(`.*[/\\\\]${this.metadata[this.type].directoryName}`, 'u')
    )

    const parsedElementName = path.parse(elementName)

    if (!Object.prototype.hasOwnProperty.call(elementSrc, srcPath)) {
      elementSrc[srcPath] = fs.readdirSync(srcPath)
    }
    elementSrc[srcPath]
      .filter(src => src.indexOf(parsedElementName.name) !== -1)
      .forEach(src =>
        this.promises.push(
          fse.copy(
            path.normalize(path.join(srcPath, src)),
            path.normalize(path.join(targetPath, src))
          )
        )
      )
  }

  handleModification() {
    this.handleAddition(this)
  }

  handleDeletion() {
    const [, srcPath, elementName] = path
      .join(this.config.repo, this.line)
      .match(this.elementRegex)

    if (fs.existsSync(path.join(srcPath, elementName))) {
      this.handleModification(this)
    } else {
      super.handleDeletion()
    }
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return parsedPath.dir + parsedPath.name
  }
}

module.exports = ResourceHandler
