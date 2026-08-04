'use strict'
import { basename } from 'node:path/posix'

import { DOT } from '../constant/fsConstants.js'
import { isPackable } from '../metadata/metadataManager.js'
import type { Config } from '../types/config.js'
import type {
  AddKind,
  CopyOperation,
  HandlerResult,
  ManifestElement,
} from '../types/handlerResult.js'
import {
  ChangeKind,
  CopyOperationKind,
  ManifestTarget,
} from '../types/handlerResult.js'
import { wrapError } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import { MessageService } from '../utils/MessageService.js'
import MetadataDiff from '../utils/metadataDiff/index.js'
import type { MetadataElement } from '../utils/metadataElement.js'
import StandardHandler from './standardHandler.js'

const getRootType = (line: string) => basename(line).split(DOT)[0]

export default class InFileHandler extends StandardHandler {
  protected readonly metadataDiff: MetadataDiff

  constructor(changeType: string, element: MetadataElement, config: Config) {
    super(changeType, element, config)
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
      const elements: ManifestElement[] = []
      const copies: CopyOperation[] = []
      const outcome = await this.metadataDiff.run(this.element.basePath)

      this._collectManifestFromComparison(
        elements,
        ManifestTarget.DestructiveChanges,
        ChangeKind.Delete,
        outcome.manifests.deleted
      )
      this._collectManifestFromComparison(
        elements,
        ManifestTarget.Package,
        ChangeKind.Add,
        outcome.manifests.added
      )
      this._collectManifestFromComparison(
        elements,
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
          await StandardHandler.prototype.collectAddition.call(this)
        elements.push(...containerResult.elements)
      }

      // run() returns a writer iff generateDelta is on and the diff has a
      // surviving add or modify — the same hasPackageContent signal above,
      // one flag driving both decisions. Subclasses like CustomLabelHandler
      // may still veto via _shouldCollectCopies.
      if (outcome.writer && this._shouldCollectCopies()) {
        copies.push({
          kind: CopyOperationKind.StreamedContent,
          path: this.element.basePath,
          writer: outcome.writer,
        })
      }

      return { elements, copies, warnings: [] }
    } catch (error) {
      const messageService = new MessageService()
      const message = messageService.getMessage('warning.MalformedXML', [
        this.element.basePath,
        this.config.from,
        this.config.to,
      ])
      // Stryker disable next-line StringLiteral -- equivalent: log content is observability only; tests assert on the wrapped warning message via wrapError, not on the lazy log line
      Logger.warn(lazy`${message}`)
      return { elements: [], copies: [], warnings: [wrapError(message, error)] }
    }
  }

  protected _collectManifestFromComparison(
    elements: ManifestElement[],
    target: ManifestTarget,
    changeKind: AddKind,
    entries: { type: string; member: string }[]
  ): void {
    for (const { type, member } of entries) {
      if (isPackable(type)) {
        elements.push({
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

  // Stryker disable next-line BlockStatement -- equivalent: the container path's copies array is local and discarded after merging only its changes back, so _delegateFileCopy returning true would push a GitCopy that is never observed by callers
  protected override _delegateFileCopy() {
    // Stryker disable next-line BooleanLiteral -- equivalent: same rationale (true would push an unobserved GitCopy)
    return false
  }

  protected _shouldTreatDeletionAsDeletion() {
    return this.element.type.pruneOnly
  }

  protected _collectsContainer(): boolean {
    return true
  }
}
