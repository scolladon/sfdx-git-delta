'use strict'
import { join, parse, sep, ParsedPath } from 'path'
import {
  ADDITION,
  DELETION,
  MODIFICATION,
  GIT_DIFF_TYPE_REGEX,
} from '../constant/gitConstants'
import { META_REGEX, METAFILE_SUFFIX } from '../constant/metadataConstants'
import {
  cleanUpPackageMember,
  fillPackageWithParameter,
} from '../utils/packageHelper'
import { copyFiles, DOT } from '../utils/fsHelper'
import { Manifest, Manifests, Work } from '../types/work'
import { Metadata } from '../types/metadata'
import { Config } from '../types/config'
import { MetadataRepository } from '../metadata/MetadataRepository'

const RegExpEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default class StandardHandler {
  protected readonly changeType: string
  protected readonly diffs: Manifests
  protected readonly config: Config
  protected readonly warnings: Error[]
  protected readonly splittedLine: string[]
  protected suffixRegex: RegExp
  protected readonly ext: string
  protected readonly metadataDef: Metadata
  protected readonly parsedLine: ParsedPath
  protected readonly parentFolder: string

  constructor(
    protected readonly line: string,
    // eslint-disable-next-line no-unused-vars
    protected readonly type: string,
    protected readonly work: Work,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {
    this.changeType = line.charAt(0) as string
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    // internal getters
    this.diffs = work.diffs
    this.config = work.config
    this.warnings = work.warnings
    this.splittedLine = this.line.split(sep)

    if (this.metadata.get(this.type)?.metaFile === true) {
      this.line = this.line.replace(METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(`\\.${this.metadata.get(this.type)?.suffix}$`)

    this.parsedLine = parse(this.line)
    this.ext = this.parsedLine.base
      .replace(METAFILE_SUFFIX, '')
      .split(DOT)
      .pop() as string

    this.parentFolder = this.parsedLine.dir.split(sep).slice(-1)[0]
    this.metadataDef = this.metadata.get(this.type) as Metadata
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
        .join(sep)

        .replace(META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  protected _getElementName() {
    const parsedPath = this._getParsedPath()
    return cleanUpPackageMember(parsedPath.base)
  }

  protected _fillPackage(store: Manifest) {
    fillPackageWithParameter({
      store,
      type: this.metadata.get(this.type)!.xmlName,
      member: this._getElementName(),
    })
  }

  protected async _copyWithMetaFile(src: string) {
    if (this._delegateFileCopy()) {
      await this._copy(src)
      if (
        this.metadataDef.metaFile === true &&
        !`${src}`.endsWith(METAFILE_SUFFIX)
      ) {
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

  protected _parseLine() {
    return this.line.match(
      new RegExp(
        `(?<path>.*[/\\\\]${RegExpEscape(
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
    return this.parentFolder !== this.type
  }
}
