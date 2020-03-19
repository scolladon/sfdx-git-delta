'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')
class InFolderHandler extends StandardHandler {
  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const regexRepo = this.config.repo !== '.' ? this.config.repo : ''

    let [, , folderPath, folderName] = path
      .join(this.config.repo, this.line)
      .match(
        new RegExp(
          `(${RegExp.escape(regexRepo)})(?<path>.*[/\\\\]${RegExp.escape(
            this.metadata[this.type].directoryName
          )})[/\\\\](?<name>[^/\\\\]*)+`,
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

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] || new Set()

    packageObject[this.type].add(
      this.splittedLine
        .slice(this.splittedLine.indexOf(this.type) + 1)
        .join(path.sep)
        .replace(StandardHandler.METAFILE_SUFFIX, '')
        .replace(`.${this.metadata[this.type].suffix}`, '')
    )
  }
}

InFolderHandler.INFOLDER_METAFILE_SUFFIX = `Folder${StandardHandler.METAFILE_SUFFIX}`
module.exports = InFolderHandler

RegExp.escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
