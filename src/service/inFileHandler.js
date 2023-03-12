'use strict'
const {
  LABEL_EXTENSION,
  LABEL_DIRECTORY_NAME,
} = require('../utils/metadataConstants')
const StandardHandler = require('./standardHandler')
const { basename } = require('path')
const { writeFile } = require('../utils/fsHelper')
const FileGitDiff = require('../utils/fileGitDiff')
const {
  cleanUpPackageMember,
  fillPackageWithParameter,
} = require('../utils/packageHelper')

const getRootType = line => basename(line).split('.')[0]
const getNamePreffix = ({ subType, line }) =>
  subType !== LABEL_DIRECTORY_NAME ? `${getRootType(line)}.` : ''

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
    const { added, deleted } = await this.fileGitDiff.compare(this.line)
    this._storeComparison(this.diffs.destructiveChanges, deleted)
    this._storeComparison(this.diffs.package, added)
  }

  async _writeScopedContent() {
    const xmlContent = this.fileGitDiff.prune()
    await writeFile(this.line, xmlContent, this.config)
  }

  _storeComparison(store, content) {
    for (const [type, members] of content) {
      for (const fullName of members) {
        this._fillPackage(store, type, fullName)
      }
    }
  }

  _fillPackage(store, subType, fullName) {
    // Call from super.handleAddition to add the Root Type
    // InFile element are not deployable when root component is not listed in package.xml...
    if (arguments.length === 1) {
      if (this.type !== LABEL_EXTENSION) {
        super._fillPackage(store)
      }
      return
    }

    const elementName = cleanUpPackageMember(
      `${getNamePreffix({ subType, line: this.line })}${fullName}`
    )

    fillPackageWithParameter({
      store,
      type: subType,
      elementName,
    })
  }
}

module.exports = InFileHandler
