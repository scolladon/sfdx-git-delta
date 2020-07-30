'use strict'
const StandardHandler = require('./standardHandler')
const mc = require('../utils/metadataConstants')
const path = require('path')
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
    folderName = `${folderName}.${
      this.metadata[this.type].xmlName.toLowerCase() +
      mc.INFOLDER_METAFILE_SUFFIX
    }`

    this._copyFiles(
      path.normalize(path.join(this.config.repo, folderPath, folderName)),
      path.normalize(path.join(this.config.output, folderPath, folderName))
    )
  }

  _fillPackage(packageObject) {
    packageObject[this.type] = packageObject[this.type] ?? new Set()

    packageObject[this.type].add(
      this.splittedLine
        .slice(this.splittedLine.indexOf(this.type) + 1)
        .join(path.sep)
        .replace(mc.METAFILE_SUFFIX, '')
        .replace(`.${this.metadata[this.type].suffix}`, '')
    )
  }
}

module.exports = InFolderHandler

RegExp.escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
