'use strict'
import { basename } from 'node:path/posix'

import { DOT } from '../constant/fsConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import { getInFileAttributes, isPackable } from '../metadata/metadataManager.js'
import { Metadata } from '../types/metadata.js'
import type { Manifest, Work } from '../types/work.js'
import { writeFile } from '../utils/fsHelper.js'
import { TraceAsyncMethod } from '../utils/LoggingDecorator.js'
import MetadataDiff from '../utils/metadataDiff.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import StandardHandler from './standardHandler.js'

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
    this.metadataDiff = new MetadataDiff(this.config, inFileMetadata)
  }

  @TraceAsyncMethod
  public override async handleAddition() {
    await this._compareRevisionAndStoreComparison()
  }

  @TraceAsyncMethod
  public override async handleDeletion() {
    if (this._shouldTreatDeletionAsDeletion()) {
      await super.handleDeletion()
    } else {
      await this.handleAddition()
    }
  }

  public override async handleModification() {
    await this.handleAddition()
  }

  protected async _compareRevisionAndStoreComparison() {
    const { added, deleted } = await this.metadataDiff.compare(this.line)
    this._storeComparison(this.diffs.destructiveChanges, deleted)
    this._storeComparison(this.diffs.package, added)
    const { xmlContent, isEmpty } = this.metadataDiff.prune()
    if (this._shouldTreatContainerType(isEmpty)) {
      // Call from super.handleAddition to add the Root Type
      // QUESTION: Why InFile element are not deployable when root component is not listed in package.xml ?
      await super.handleAddition()
    }
    if (this.config.generateDelta && !isEmpty) {
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

  protected _shouldTreatContainerType(fileIsEmpty: boolean) {
    return !fileIsEmpty
  }
}
