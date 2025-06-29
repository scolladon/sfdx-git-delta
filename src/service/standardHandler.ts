'use strict'
import { join, ParsedPath, parse } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} from '../constant/gitConstants.js'
import { META_REGEX, METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'
import type { Metadata } from '../types/metadata.js'
import type { Manifest, Manifests, Work } from '../types/work.js'
import { copyFiles } from '../utils/fsHelper.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'

const RegExpEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default class StandardHandler {
  protected readonly changeType: string
  protected readonly diffs: Manifests
  protected readonly config: Config
  protected readonly warnings: Error[]
  protected readonly splittedLine: string[]
  protected suffixRegex: RegExp
  protected readonly ext: string
  protected readonly parsedLine: ParsedPath
  protected readonly parentFolder: string

  constructor(
    protected readonly line: string,
    protected readonly metadataDef: Metadata,
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {
    this.changeType = line.charAt(0) as string
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    this.diffs = work.diffs
    this.config = work.config
    this.warnings = work.warnings
    this.splittedLine = this.line.split(PATH_SEP)

    if (this.metadataDef.metaFile === true) {
      this.line = this.line.replace(METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(`\\.${this.metadataDef.suffix}$`)
    this.parsedLine = parse(this.line)
    this.ext = this.parsedLine.base
      .replace(METAFILE_SUFFIX, '')
      .split(DOT)
      .pop() as string
    this.parentFolder = this.parsedLine.dir.split(PATH_SEP).slice(-1)[0]
  }

  public async handle() {
    if (this._isProcessable()) {
      try {
        switch (this.changeType) {
          case ADDITION:
            await this.handleAddition()
            break
          case DELETION:
            await this.handleDeletion()
            break
          case MODIFICATION:
            await this.handleModification()
            break
        }
      } catch (error) {
        if (error instanceof Error) {
          error.message = `${this.line}: ${error.message}`
          this.warnings.push(error)
        }
      }
    }
  }

  public async handleAddition() {
    this._fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    await this._copyWithMetaFile(this.line)
  }

  public async handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  public async handleModification() {
    await this.handleAddition()
  }

  protected _getParsedPath() {
    return parse(
      this.splittedLine
        .slice(
          this.splittedLine.findIndex(x => x.includes(METAFILE_SUFFIX)) - 1
        )
        .join(PATH_SEP)
        .replace(META_REGEX, '')
    )
  }

  protected _getElementName() {
    const parsedPath = this._getParsedPath()
    return parsedPath.name
  }

  protected _fillPackage(store: Manifest) {
    fillPackageWithParameter({
      store,
      type: this.metadataDef.xmlName!,
      member: this._getElementName(),
    })
  }

  protected async _copyWithMetaFile(src: string) {
    if (this._delegateFileCopy()) {
      await this._copy(src)
      if (this._shouldCopyMetaFile(src)) {
        await this._copy(this._getMetaTypeFilePath(src))
      }
    }
  }

  protected async _copy(elementPath: string) {
    if (this._delegateFileCopy()) {
      await copyFiles(this.config, elementPath)
    }
  }

  protected _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${this.metadataDef.suffix}${METAFILE_SUFFIX}`
    )
  }

  protected _shouldCopyMetaFile(path: string): boolean {
    return (
      this.metadataDef.metaFile === true && !`${path}`.endsWith(METAFILE_SUFFIX)
    )
  }

  protected _parseLine() {
    return this.line.match(
      new RegExp(
        `(?<path>.*[/\\\\]?${RegExpEscape(
          this.metadataDef.directoryName
        )})[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
  }

  protected _isProcessable() {
    return this.metadataDef.suffix === this.ext
  }

  protected _delegateFileCopy() {
    return true
  }

  protected _parentFolderIsNotTheType() {
    return this.parentFolder !== this.metadataDef.directoryName
  }
}
