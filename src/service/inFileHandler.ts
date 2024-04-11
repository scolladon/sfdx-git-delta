'use strict'
import { basename } from 'path'

import { DOT } from '../constant/fsConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { getInFileAttributes, isPackable } from '../metadata/metadataManager'
import { Metadata } from '../types/metadata'
import type { Manifest, Work } from '../types/work'
import { writeFile } from '../utils/fsHelper'
import MetadataDiff from '../utils/metadataDiff'
import { fillPackageWithParameter } from '../utils/packageHelper'

import StandardHandler from './standardHandler'

const getRootType = (line: string) => basename(line).split(DOT)[0]

export default class InFileHandler extends StandardHandler {
  protected readonly metadataDiff: MetadataDiff
  constructor(
    line: string,
    metadataDef: Metadata,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, metadataDef, work, metadata)
    const inFileMetadata = getInFileAttributes(metadata)
    this.metadataDiff = new MetadataDiff(this.config, metadata, inFileMetadata)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
  }

  public override async handleAddition() {
    await this._compareRevisionAndStoreComparison()

    if (!this.config.generateDelta) return
    await this._writeScopedContent()
  }

  public override async handleDeletion() {
    if (this._shouldTreatDeletionAsDeletion()) {
      await super.handleDeletion()
    } else {
      await this._compareRevisionAndStoreComparison()
    }
  }

  public override async handleModification() {
    await this.handleAddition()
  }

  protected async _compareRevisionAndStoreComparison() {
    const { added, deleted } = await this.metadataDiff.compare(this.line)
    this._storeComparison(this.diffs.destructiveChanges, deleted)
    this._storeComparison(this.diffs.package, added)
    if (this._shouldTreatContainerType(added.size)) {
      // Call from super.handleAddition to add the Root Type
      // QUESTION: Why InFile element are not deployable when root component is not listed in package.xml ?
      await super.handleAddition()
    }
  }

  protected async _writeScopedContent() {
    const { xmlContent, isEmpty } = this.metadataDiff.prune()

    if (!isEmpty) {
      await writeFile(this.line, xmlContent, this.config)
    }
  }

  protected _storeComparison(store: Manifest, content: Manifest) {
    for (const [type, members] of content) {
      for (const member of members) {
        this._fillPackageForInfileMetadata(store, type, member)
      }
    }
  }

  protected _fillPackageForInfileMetadata(
    store: Manifest,
    subType: string,
    member: string
  ) {
    if (isPackable(subType)) {
      const cleanedMember = `${this._getQualifiedName()}${member}`

      fillPackageWithParameter({
        store,
        type: subType,
        member: cleanedMember,
      })
    }
  }

  protected _getQualifiedName() {
    return `${getRootType(this.line)}${DOT}`
  }

  protected override _delegateFileCopy() {
    return false
  }

  protected _shouldTreatDeletionAsDeletion() {
    return this.metadataDef.pruneOnly
  }

  protected _shouldTreatContainerType(modificationLength: number) {
    return modificationLength > 0
  }
}
