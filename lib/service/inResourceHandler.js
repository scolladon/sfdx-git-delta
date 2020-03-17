'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')

const staticResourceRegex = /(?<path>.*[/\\]staticresources)[/\\](?<name>[^/\\]*)+/u

const staticResourcesSrc = {}

class ResourceHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    const [, srcPath, resourceName] = path
      .join(this.config.repo, this.line)
      .match(staticResourceRegex)
    const [targetPath] = `${path.join(this.config.output, this.line)}`.match(
      /.*[/\\]staticresources/u
    )

    const parsedResourceName = path.parse(resourceName)

    if (!Object.prototype.hasOwnProperty.call(staticResourcesSrc, srcPath)) {
      staticResourcesSrc[srcPath] = fs.readdirSync(srcPath)
    }
    staticResourcesSrc[srcPath]
      .filter(src => src.indexOf(parsedResourceName.name) !== -1)
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
    this.handleAddition.apply(this)
  }

  handleDeletion() {
    const [, srcPath, resourceName] = path
      .join(this.config.repo, this.line)
      .match(staticResourceRegex)

    if (fs.existsSync(path.join(srcPath, resourceName))) {
      this.handleModification.apply(this)
    } else {
      super.handleDeletion()
    }
  }
}

module.exports = ResourceHandler
