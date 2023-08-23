'use strict'
import { LABEL_EXTENSION, LABEL_XML_NAME } from '../utils/metadataConstants'
import StandardHandler from './standardHandler'
import { basename } from 'path'
import { writeFile, DOT } from '../utils/fsHelper'
import { getInFileAttributes, isPackable } from '../metadata/metadataManager'
import MetadataDiff from '../utils/metadataDiff'
import {
  cleanUpPackageMember,
  fillPackageWithParameter,
} from '../utils/packageHelper'
import { Manifest, Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'

const getRootType = (line: string) => basename(line).split(DOT)[0]
const getNamePrefix = ({ subType, line }: { subType: string; line: string }) =>
  subType !== LABEL_XML_NAME ? `${getRootType(line)}.` : ''

export default class InFileHandler extends StandardHandler {
  metadataDiff: MetadataDiff
  _addedMembers: Manifest
  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
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
    if (this.metadataDef.pruneOnly) {
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
    const { xmlContent, isEmpty } = this.metadataDiff.prune()

    if (!isEmpty) {
      await writeFile(this.line, xmlContent, this.config)
    }
  }

  _storeComparison(store: Manifest, content: Manifest) {
    for (const [type, members] of content) {
      for (const member of members) {
        this._fillPackageForInfileMetadata(store, type, member)
      }
    }
  }

  _fillPackageForInfileMetadata(
    store: Manifest,
    subType: string,
    member: string
  ) {
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

  _delegateFileCopy() {
    return false
  }

  _fillPackage(store: Manifest) {
    // Call from super.handleAddition to add the Root Type
    // QUESTION: Why InFile element are not deployable when root component is not listed in package.xml ?
    if (this.type !== LABEL_EXTENSION) {
      super._fillPackage(store)
    }
  }
}
