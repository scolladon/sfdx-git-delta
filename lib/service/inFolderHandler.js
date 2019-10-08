'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')
class InFolderHandler extends StandardHandler {
  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set()
    this.diffs[this.type].add(
      this.splittedLine

        .slice(this.splittedLine.indexOf(this.type) + 1)
        .join(path.sep)
        .replace(StandardHandler.METAFILE_SUFFIX, '')
        .replace(`.${this.metadata[this.type].suffix}`, '')
    )
  }

  handleAddition() {
    super.handleAddition()

    let [, folderPath, folderName] = path
      .join(this.config.repo, this.line)
      .match(
        new RegExp(
          `${this.config.repo}(?<path>.*[/\\\\]${this.metadata[this.type].directoryName})[/\\\\](?<name>[^/\\\\]*)+`,
          'u'
        )
      )
    folderName = `${folderName}.${this.metadata[
      this.type
    ].xmlName.toLowerCase() + InFolderHandler.INFOLDER_METAFILE_SUFFIX}`

    this.promises.push(
      fse.copy(
        path.normalize(path.join(this.config.repo, folderPath, folderName)),
        path.normalize(path.join(this.config.output, folderPath, folderName))
      )
    )
  }
}

InFolderHandler.INFOLDER_METAFILE_SUFFIX = `Folder${StandardHandler.METAFILE_SUFFIX}`
module.exports = InFolderHandler
