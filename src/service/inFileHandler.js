'use strict'
const {
  LABEL_EXTENSION,
  LABEL_XML_NAME,
} = require('../utils/metadataConstants')
const StandardHandler = require('./standardHandler')
const { basename } = require('path')
const { writeFile } = require('../utils/fsHelper')
const { getInFileAttributs } = require('../metadata/metadataManager')
const MetadataDiff = require('../utils/metadataDiff')
const {
  cleanUpPackageMember,
  fillPackageWithParameter,
} = require('../utils/packageHelper')

const isPackageable = type =>
  !Object.values(inFileMetadata).find(inFileDef => inFileDef.xmlName === type)
    .excluded
const getRootType = line => basename(line).split('.')[0]
const getNamePreffix = ({ subType, line }) =>
  subType !== LABEL_XML_NAME ? `${getRootType(line)}.` : ''

let inFileMetadata

class InFileHandler extends StandardHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
    inFileMetadata = inFileMetadata ?? getInFileAttributs(metadata)
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
    // InFile element are not deployable when root component is not listed in package.xml...
    if (arguments.length === 1) {
      if (this.type !== LABEL_EXTENSION) {
        super._fillPackage(store)
      }
      return
    }

    if (isPackageable(subType)) {
      const cleanedMember = cleanUpPackageMember(
        `${getNamePreffix({ subType, line: this.line })}${member}`
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
