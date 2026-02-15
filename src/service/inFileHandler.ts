'use strict'
import { basename } from 'node:path/posix'

import { DOT } from '../constant/fsConstants.js'
import { isPackable } from '../metadata/metadataManager.js'
import type { HandlerResult, ManifestElement } from '../types/handlerResult.js'
import {
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import MetadataDiff from '../utils/metadataDiff.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import StandardHandler from './standardHandler.js'

const getRootType = (line: string) => basename(line).split(DOT)[0]

export default class InFileHandler extends StandardHandler {
  protected readonly metadataDiff: MetadataDiff

  constructor(changeType: string, element: MetadataElement, work: Work) {
    super(changeType, element, work)
    const inFileMetadata = element.getInFileAttributes()
    this.metadataDiff = new MetadataDiff(this.config, inFileMetadata)
  }

  public override async collectAddition(): Promise<HandlerResult> {
    return await this._collectCompareResult()
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    if (this._shouldTreatDeletionAsDeletion()) {
      return await super.collectDeletion()
    }
    return await this.collectAddition()
  }

  public override async collectModification(): Promise<HandlerResult> {
    return await this.collectAddition()
  }

  protected async _collectCompareResult(): Promise<HandlerResult> {
    const result = emptyResult()
    const { added, deleted, toContent, fromContent } =
      await this.metadataDiff.compare(this.element.basePath)

    this._collectManifestFromComparison(
      result.manifests,
      ManifestTarget.DestructiveChanges,
      deleted
    )
    this._collectManifestFromComparison(
      result.manifests,
      ManifestTarget.Package,
      added
    )

    const { xmlContent, isEmpty } = this.metadataDiff.prune(
      toContent,
      fromContent
    )

    if (this._shouldTreatContainerType(isEmpty)) {
      const containerResult =
        await StandardHandler.prototype.collectAddition.call(this)
      result.manifests.push(...containerResult.manifests)
      result.copies.push(...containerResult.copies)
    }

    if (!isEmpty) {
      result.copies.push({
        kind: CopyOperationKind.ComputedContent,
        path: this.element.basePath,
        content: xmlContent,
      })
    }

    return result
  }

  protected _collectManifestFromComparison(
    manifests: ManifestElement[],
    target: ManifestTarget,
    entries: { type: string; member: string }[]
  ): void {
    for (const { type, member } of entries) {
      if (isPackable(type)) {
        manifests.push({
          target,
          type,
          member: `${this._getQualifiedName()}${member}`,
        })
      }
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
