'use strict'
const {
  LABEL_EXTENSION,
  LABEL_XML_NAME,
} = require('../utils/metadataConstants')
const StandardHandler = require('./standardHandler')
const { basename } = require('path')
const { writeFile } = require('../utils/fsHelper')
const MetadataDiff = require('../utils/metadataDiff')
const {
  cleanUpPackageMember,
  fillPackageWithParameter,
} = require('../utils/packageHelper')

const getRootType = line => basename(line).split('.')[0]
const getNamePreffix = ({ subType, line }) =>
  subType !== LABEL_XML_NAME ? `${getRootType(line)}.` : ''

const getInFileAttributs = metadata => {
  return [...metadata.values()]
    .filter(meta => meta.xmlTag)
    .reduce((acc, meta) => {
      acc[meta.xmlTag] = { xmlName: meta.xmlName, key: 'fullName' }
      return acc
    }, {})
}
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
    await this._compareRevision()
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

    const member = cleanUpPackageMember(
      `${getNamePreffix({ subType, line: this.line })}${fullName}`
    )

    fillPackageWithParameter({
      store,
      type: subType,
      member,
    })
  }
}

module.exports = InFileHandler
