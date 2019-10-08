'use strict'
const StandardHandler = require('./standardHandler')
const path = require('path')
const fse = require('fs-extra')

const foldersSrc = {}
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
    const [, folderPath, folderName] = path
      .join(this.config.repo, this.line)
      .match(
        new RegExp(
          `(?<path>.*[/\\]${this.type.directoryName})\/(?<name>[^/\\]*)+`,
          'u'
        )
      )
    const [targetPath] = `${path.join(this.config.output, this.line)}`.match(
      /.*[/\\]staticresources/u
    )

    const folderParsed = path.parse(folderName)

    if (!Object.prototype.hasOwnProperty.call(foldersSrc, folderPath)) {
      foldersSrc[folderPath] = fs.readdirSync(folderPath)
    }
    foldersSrc[folderPath]
      .filter(src => src.indexOf(folderParsed.name) !== -1)
      .forEach(src =>
        this.promises.push(
          fse.copy(
            path.normalize(path.join(folderPath, src)),
            path.normalize(path.join(targetPath, src))
          )
        )
      )
  }
}

module.exports = InFolderHandler
