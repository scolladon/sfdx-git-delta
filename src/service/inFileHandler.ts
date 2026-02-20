'use strict'
import { basename } from 'node:path/posix'

import { DOT } from '../constant/fsConstants.js'
import { isPackable } from '../metadata/metadataManager.js'
import type { HandlerResult, ManifestElement } from '../types/handlerResult.js'
import { emptyResult, ManifestTarget } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { pushAll } from '../utils/arrayUtils.js'
import { wrapError } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import { MessageService } from '../utils/MessageService.js'
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
    try {
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

      // RATIONALE: Why include root component in package.xml for InFile sub-elements?
      // InFile elements are not independently deployable; the root component must be listed.
      // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#infile-elements
      if (this._shouldTreatContainerType(isEmpty)) {
        const containerResult =
          await StandardHandler.prototype.collectAddition.call(this)
        pushAll(result.manifests, containerResult.manifests)
      }

      // Separate from _shouldTreatContainerType: subclasses (e.g. CustomLabelHandler)
      // may disable container manifests while still needing computed content
      if (!isEmpty) {
        this._collectComputedContent(
          result.copies,
          this.element.basePath,
          xmlContent
        )
      }

      return result
    } catch (error) {
      const messageService = new MessageService()
      const message = messageService.getMessage('warning.MalformedXML', [
        this.element.basePath,
        this.config.from,
        this.config.to,
      ])
      Logger.warn(lazy`${message}`)
      return {
        manifests: [],
        copies: [],
        warnings: [wrapError(message, error)],
      }
    }
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
