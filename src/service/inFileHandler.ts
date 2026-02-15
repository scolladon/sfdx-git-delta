'use strict'
import { basename } from 'node:path/posix'

import { DOT } from '../constant/fsConstants.js'
import { isPackable } from '../metadata/metadataManager.js'
import type { Manifest, Work } from '../types/work.js'
import { writeFile } from '../utils/fsHelper.js'
import { log } from '../utils/LoggingDecorator.js'
import MetadataDiff from '../utils/metadataDiff.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import StandardHandler from './standardHandler.js'

const getRootType = (line: string) => basename(line).split(DOT)[0]

export default class InFileHandler extends StandardHandler {
  protected readonly metadataDiff: MetadataDiff

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    const inFileMetadata = element.getInFileAttributes()
    this.metadataDiff = new MetadataDiff(this.config, inFileMetadata)
  }

  @log
  public override async handleAddition() {
    await this._compareRevisionAndStoreComparison()
  }

  @log
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
    const { added, deleted, toContent, fromContent } =
      await this.metadataDiff.compare(this.element.basePath)
    this._storeComparison(this.diffs.destructiveChanges, deleted)
    this._storeComparison(this.diffs.package, added)
    const { xmlContent, isEmpty } = this.metadataDiff.prune(
      toContent,
      fromContent
    )
    if (this._shouldTreatContainerType(isEmpty)) {
      // QUESTION: Why InFile element are not deployable when root component is not listed in package.xml ?
      await super.handleAddition()
    }
    if (this.config.generateDelta && !isEmpty) {
      await writeFile(this.element.basePath, xmlContent, this.config)
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
    return `${getRootType(this.element.basePath)}${DOT}`
  }

  protected override _delegateFileCopy() {
    return false
  }

  protected _shouldTreatDeletionAsDeletion() {
    return this.element.type.pruneOnly
  }

  protected _shouldTreatContainerType(fileIsEmpty?: boolean): boolean {
    return !fileIsEmpty
  }
}
