'use strict'
import { basename } from 'node:path/posix'

import { DOT } from '../constant/fsConstants.js'
import { isPackable } from '../metadata/metadataManager.js'
import type { AddKind, HandlerResult } from '../types/handlerResult.js'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type ChangeSet from '../utils/changeSet.js'
import { wrapError } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import { MessageService } from '../utils/MessageService.js'
import MetadataDiff from '../utils/metadataDiff/index.js'
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

  public override async collectAddition(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    return await this._collectCompareResult(sink)
  }

  public override async collectDeletion(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    if (this._shouldTreatDeletionAsDeletion()) {
      return await super.collectDeletion(sink)
    }
    return await this.collectAddition(sink)
  }

  public override async collectModification(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    return await this.collectAddition(sink)
  }

  protected async _collectCompareResult(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    try {
      const result = this._emptyResultFor(sink)
      const outcome = await this.metadataDiff.run(this.element.basePath)

      this._collectManifestFromComparison(
        result.changes,
        ManifestTarget.DestructiveChanges,
        ChangeKind.Delete,
        outcome.manifests.deleted
      )
      this._collectManifestFromComparison(
        result.changes,
        ManifestTarget.Package,
        ChangeKind.Add,
        outcome.manifests.added
      )
      this._collectManifestFromComparison(
        result.changes,
        ManifestTarget.Package,
        ChangeKind.Modify,
        outcome.manifests.modified
      )

      // RATIONALE: InFile elements are not independently deployable; the
      // root component must be listed in package.xml whenever children
      // survive the diff. hasPackageContent captures that signal
      // independent of generateDelta — see DiffOutcome / StreamingDiff.
      // Delete-only changes go to destructiveChanges.xml only; their
      // parent must NOT be re-listed in package.xml because nothing
      // deployable remains.
      // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#infile-elements
      if (this._collectsContainer() && outcome.hasPackageContent) {
        const containerResult =
          await StandardHandler.prototype.collectAddition.call(this, sink)
        result.changes.merge(containerResult.changes)
      }

      // run() returns a writer iff generateDelta is on and the to-side
      // has retained content. Subclasses like CustomLabelHandler may
      // still veto via _shouldCollectCopies.
      if (outcome.writer && this._shouldCollectCopies()) {
        result.copies.push({
          kind: CopyOperationKind.StreamedContent,
          path: this.element.basePath,
          writer: outcome.writer,
        })
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
      const failed = emptyResult()
      failed.warnings.push(wrapError(message, error))
      return failed
    }
  }

  protected _collectManifestFromComparison(
    changes: ChangeSet,
    target: ManifestTarget,
    changeKind: AddKind,
    entries: { type: string; member: string }[]
  ): void {
    for (const { type, member } of entries) {
      if (isPackable(type)) {
        changes.addElement({
          target,
          type,
          member: `${this._getQualifiedName()}${member}`,
          changeKind,
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

  protected _collectsContainer(): boolean {
    return true
  }
}
