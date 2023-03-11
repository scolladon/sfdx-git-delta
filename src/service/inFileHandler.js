'use strict'
const {
  LABEL_EXTENSION,
  LABEL_DIRECTORY_NAME,
} = require('../utils/metadataConstants')
const StandardHandler = require('./standardHandler')
const { basename } = require('path')
const { writeFile } = require('../utils/fsHelper')
const FileGitDiff = require('../utils/fileGitDiff')
const { fillPackageWithParameter } = require('../utils/packageHelper')

class InFileHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    this.fileGitDiff = new FileGitDiff(
      metadata.get(this.type)?.directoryName,
      this.config,
      metadata
    )
  }

  async handleAddition() {
    await super.handleAddition()
    await this._compareRevision()

    if (!this.config.generateDelta) return
    await this._writeScopedContent()
  }

  async handleDeletion() {
    await this._compareRevision()
  }

  async handleModification() {
    await this.handleAddition()
  }

  async _compareRevision() {
    const comparisonResult = await this.fileGitDiff.compare(this.line)
    this._storeComparison(comparisonResult)
  }

  async _writeScopedContent() {
    const scopedFile = await this.fileGitDiff.scope()
    await writeFile(this.line, scopedFile, this.config)
  }

  _storeComparison({ added, deleted }) {
    // TODO Why we should filter here ?
    for (const [type, members] of deleted) {
      ;[...members]
        .filter(elem => !added.get(type)?.has(elem))
        .forEach(fullName =>
          this._fillPackage(this.diffs.destructiveChanges, type, fullName)
        )
    }
    for (const [type, members] of added) {
      for (let fullName of members) {
        this._fillPackage(this.diffs.package, type, fullName)
      }
    }
  }

  _fillPackage(packageObject, subType, elementName) {
    if (subType && elementName) {
      const elementFullName = StandardHandler.cleanUpPackageMember(
        `${
          (subType !== LABEL_DIRECTORY_NAME
            ? `${basename(this.line).split('.')[0]}.`
            : '') + elementName
        }`
      )

      fillPackageWithParameter({
        package: packageObject,
        type: subType,
        elementName: elementFullName,
      })
    } else {
      if (this.type !== LABEL_EXTENSION) {
        super._fillPackage(packageObject)
      }
    }
  }
}

module.exports = InFileHandler
