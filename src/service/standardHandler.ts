'use strict'
import { join, parse } from 'node:path/posix'

import { ADDITION, DELETION, MODIFICATION } from '../constant/gitConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { Config } from '../types/config.js'
import type {
  AddKind,
  CopyOperation,
  HandlerResult,
} from '../types/handlerResult.js'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import type ChangeSet from '../utils/changeSet.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import type { MetadataElement } from '../utils/metadataElement.js'

const CHANGE_KIND_BY_GIT_TYPE: Readonly<Record<string, AddKind>> = {
  [ADDITION]: ChangeKind.Add,
  [MODIFICATION]: ChangeKind.Modify,
  [DELETION]: ChangeKind.Delete,
}

/**
 * Strategy pattern base for metadata type handlers.
 * Each Salesforce metadata type may need unique diff-collection behavior
 * (e.g. custom element naming, parent object detection, deletion warnings).
 * Subclasses override specific hooks (_getElementName, _isProcessable,
 * collectAddition, collectDeletion, etc.) — even thin subclasses that override
 * a single method justify their existence because they are selected at runtime
 * by TypeHandlerFactory based on metadata type definitions.
 */
export default class StandardHandler {
  protected readonly config: Config

  constructor(
    protected readonly changeType: string,
    protected readonly element: MetadataElement,
    protected readonly work: Work
  ) {
    this.config = work.config
  }

  // `sink` lets the orchestrator (DiffLineInterpreter) share one ChangeSet
  // across every handler in a pass, eliminating ~N per-handler ChangeSet
  // allocations and their later merge. When omitted (tests, ad-hoc callers)
  // each call still gets its own fresh ChangeSet via `emptyResult()`, so the
  // existing test API (`await sut.collectAddition()`) stays unchanged.
  @log
  public async collect(sink?: ChangeSet): Promise<HandlerResult> {
    if (!this._isProcessable()) {
      return this._emptyResultFor(sink)
    }
    try {
      switch (this.changeType) {
        case ADDITION:
          return await this.collectAddition(sink)
        case DELETION:
          return await this.collectDeletion(sink)
        case MODIFICATION:
          return await this.collectModification(sink)
        default:
          return this._emptyResultFor(sink)
      }
    } catch (error) {
      const message = `${this.element.basePath}: ${getErrorMessage(error)}`
      // Stryker disable next-line StringLiteral -- equivalent: lazy log content is observability only; tests assert on the wrapped warning message in result.warnings via wrapError, not on the lazy log line
      Logger.warn(lazy`${message}`)
      Logger.debug(
        // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: same as above, debug log is observability only
        lazy`${this.constructor.name}.collect: ${this.changeType} ${this.element.type.xmlName} '${this.element.basePath}' failed: ${() => getErrorMessage(error)}`
      )
      const failed = this._emptyResultFor(sink)
      failed.warnings.push(wrapError(message, error))
      return failed
    }
  }

  public async collectAddition(sink?: ChangeSet): Promise<HandlerResult> {
    const result = this._emptyResultFor(sink)
    result.changes.addElement(
      this._collectManifestElement(ManifestTarget.Package)
    )
    this._collectCopyWithMetaFile(result.copies, this.element.basePath)
    return result
  }

  public async collectDeletion(sink?: ChangeSet): Promise<HandlerResult> {
    const result = this._emptyResultFor(sink)
    result.changes.addElement(
      this._collectManifestElement(ManifestTarget.DestructiveChanges)
    )
    return result
  }

  public async collectModification(sink?: ChangeSet): Promise<HandlerResult> {
    return await this.collectAddition(sink)
  }

  protected _emptyResultFor(sink?: ChangeSet): HandlerResult {
    // Stryker disable next-line ObjectLiteral,ArrayDeclaration -- equivalent: see v8 ignore — production callers always pass a sink, so the truthy branch is the only reachable one and the {changes,copies,warnings} shape is asserted by the consumer via specific keys
    /* v8 ignore next -- defensive: production callers always pass a sink; the no-sink fallback exists for legacy / direct-handler tests */
    return sink ? { changes: sink, copies: [], warnings: [] } : emptyResult()
  }

  protected _getElementName() {
    return this.element.componentName
  }

  // Public accessor used by the rename resolver — lets main.ts map a rename
  // path pair back to (type, member) without running collect() side-effects.
  public getElementDescriptor(): { type: string; member: string } {
    return {
      type: this.element.type.xmlName!,
      member: this._getElementName(),
    }
  }

  protected _collectManifestElement(target: ManifestTarget) {
    return {
      target,
      ...this.getElementDescriptor(),
      changeKind: this._getChangeKind(),
    }
  }

  protected _getChangeKind(): AddKind {
    // collect()'s switch guarantees changeType is ADDITION | MODIFICATION |
    // DELETION before _collectManifestElement runs, so the lookup always hits.
    return CHANGE_KIND_BY_GIT_TYPE[this.changeType]!
  }

  protected _collectCopyWithMetaFile(
    copies: CopyOperation[],
    src: string
  ): void {
    if (this._delegateFileCopy()) {
      this._collectCopy(copies, src)
      if (this._shouldCopyMetaFile(src)) {
        this._collectCopy(copies, this._getMetaTypeFilePath(src))
      }
    }
  }

  protected _collectCopy(copies: CopyOperation[], path: string): void {
    if (!this._shouldCollectCopies()) return
    copies.push({
      kind: CopyOperationKind.GitCopy,
      path,
      revision: this.config.to,
    })
  }

  protected _shouldCollectCopies(): boolean {
    return this.config.generateDelta
  }

  protected _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${this.element.type.suffix}${METAFILE_SUFFIX}`
    )
  }

  protected _shouldCopyMetaFile(path: string): boolean {
    return (
      this.element.type.metaFile === true &&
      !`${path}`.endsWith(METAFILE_SUFFIX)
    )
  }

  protected _isProcessable() {
    return this.element.type.suffix === this.element.extension
  }

  protected _delegateFileCopy() {
    return true
  }

  protected _parentFolderIsNotTheType() {
    return this.element.parentFolder !== this.element.type.directoryName
  }

  public toString() {
    return `${this.constructor.name}: ${this.changeType} -> ${this.element.basePath}`
  }
}
