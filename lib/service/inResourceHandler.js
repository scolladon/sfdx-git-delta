'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')

const staticResourcesSrc = {}

class ResourceHandler extends StandardHandler {
  handleAddtion() {
    const [, srcPath, resourceName] = path
      .join(this.config.repo, this.line)
      .match(/(?<path>.*[/\\]staticresources)\/(?<name>[^/\\]*)+/u)
    const [targetPath] = `${path.join(this.config.output, this.line)}`.match(
      /.*[/\\]staticresources/u
    )

    if (!Object.prototype.hasOwnProperty.call(staticResourcesSrc, srcPath)) {
      staticResourcesSrc[srcPath] = fs.readdirSync(srcPath)
    }
    staticResourcesSrc[srcPath]
      .filter(src => src.indexOf(resourceName) !== -1)
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
    this.handleAddtion.apply(this)
  }

  handleDeletion() {
    const [, srcPath, resourceName] = path
      .join(this.config.repo, this.line)
      .match(/(?<path>.*[/\\]staticresources)\/(?<name>[^/\\]*)+/u)

    if (fs.existsSync(path.join(srcPath, resourceName))) {
      this.handleModification.apply(this)
    } else {
      super.handleDeletion()
    }
  }
}

module.exports = ResourceHandler
