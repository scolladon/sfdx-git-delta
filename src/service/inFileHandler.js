'use strict'
const {
  LABEL_EXTENSION,
  LABEL_XML_NAME,
} = require('../utils/metadataConstants')
const StandardHandler = require('./standardHandler')
const { basename } = require('path')
const { writeFile } = require('../utils/fsHelper')
const {
  getInFileAttributes,
  isPackable,
} = require('../metadata/metadataManager')
const MetadataDiff = require('../utils/metadataDiff')
const {
  cleanUpPackageMember,
  fillPackageWithParameter,
} = require('../utils/packageHelper')

const getRootType = line => basename(line).split('.')[0]
const getNamePrefix = ({ subType, line }) =>
  subType !== LABEL_XML_NAME ? `${getRootType(line)}.` : ''

class InFileHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    const inFileMetadata = getInFileAttributes(metadata)
    this.metadataDiff = new MetadataDiff(this.config, metadata, inFileMetadata)
  }

  async handleAddition() {
    await super.handleAddition()
    await this._compareRevision()

    if (!this.config.generateDelta) return
    await this._writeScopedContent()
  }

  async handleDeletion() {
    if (this.metadata.get(this.type).pruneOnly) {
      await super.handleDeletion()
    } else {
      await this._compareRevision()
    }
  }

  async handleModification() {
    await this.handleAddition()
  }

  async _compareRevision() {
    const { added, deleted } = await this.metadataDiff.compare(this.line)
    this._storeComparison(this.diffs.destructiveChanges, deleted)
    this._storeComparison(this.diffs.package, added)
  }

  async _writeScopedContent() {
    const xmlContent = this.metadataDiff.prune()
    await writeFile(this.line, xmlContent, this.config)
  }

  _storeComparison(store, content) {
    for (const [type, members] of content) {
      for (const member of members) {
        this._fillPackage(store, type, member)
      }
    }
  }

  _fillPackage(store, subType, member) {
    // Call from super.handleAddition to add the Root Type
    // QUESTION: Why InFile element are not deployable when root component is not listed in package.xml ?
    if (arguments.length === 1) {
      if (this.type !== LABEL_EXTENSION) {
        super._fillPackage(store)
      }
      return
    }

    if (isPackable(subType)) {
      const cleanedMember = cleanUpPackageMember(
        `${getNamePrefix({ subType, line: this.line })}${member}`
      )

      fillPackageWithParameter({
        store,
        type: subType,
        member: cleanedMember,
      })
    }
  }
}

module.exports = InFileHandler
