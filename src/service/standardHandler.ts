'use strict'
import { join, parse, sep, ParsedPath } from 'path'
import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} from '../utils/gitConstants'
import { META_REGEX, METAFILE_SUFFIX } from '../utils/metadataConstants'
import {
  cleanUpPackageMember,
  fillPackageWithParameter,
} from '../utils/packageHelper'
import { copyFiles, DOT } from '../utils/fsHelper'
import { Manifest, Manifests, Work } from '../types/work'
import { Metadata, MetadataRepository } from '../types/metadata'
import { Config } from '../types/config'

const RegExpEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

type HandlerDef = {
  [ADDITION]: () => Promise<void>
  [DELETION]: () => void
  [MODIFICATION]: () => Promise<void>
}

export default class StandardHandler {
  metadata: MetadataRepository
  changeType: keyof HandlerDef
  line: string
  type: string
  work: Work
  diffs: Manifests
  config: Config
  warnings: Error[]
  splittedLine: string[]
  suffixRegex: RegExp
  handlerMap: HandlerDef
  ext: string
  metadataDef: Metadata
  parsedLine: ParsedPath
  parentFolder: string

  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
    this.metadata = metadata
    this.changeType = line.charAt(0) as keyof HandlerDef
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    this.type = type
    this.work = work
    // internal getters
    this.diffs = work.diffs
    this.config = work.config
    this.warnings = work.warnings
    this.splittedLine = this.line.split(sep)

    if (this.metadata.get(this.type)?.metaFile === true) {
      this.line = this.line.replace(METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(`\\.${this.metadata.get(this.type)?.suffix}$`)

    this.handlerMap = {
      [ADDITION]: this.handleAddition,
      [DELETION]: this.handleDeletion,
      [MODIFICATION]: this.handleModification,
    }
    this.parsedLine = parse(this.line)
    this.ext = this.parsedLine.base
      .replace(METAFILE_SUFFIX, '')
      .split(DOT)
      .pop() as string

    this.parentFolder = this.parsedLine.dir.split(sep).slice(-1)[0]
    this.metadataDef = this.metadata.get(this.type) as Metadata
  }

  async handle() {
    if (this.handlerMap[this.changeType] && this._isProcessable()) {
      try {
        await this.handlerMap[this.changeType].apply(this)
      } catch (error) {
        error.message = `${this.line}: ${error.message}`
        this.warnings.push(error)
      }
    }
  }

  async handleAddition() {
    this._fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    await this._copyWithMetaFile(this.line)
  }

  handleDeletion() {
    this._fillPackage(this.diffs.destructiveChanges)
  }

  async handleModification() {
    await this.handleAddition()
  }

  _getParsedPath() {
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

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return cleanUpPackageMember(parsedPath.base)
  }

  _fillPackage(store: Manifest) {
    fillPackageWithParameter({
      store,
      type: this.metadata.get(this.type)!.xmlName,
      member: this._getElementName(),
    })
  }

  async _copyWithMetaFile(src: string) {
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

  async _copy(elementPath: string) {
    if (this._delegateFileCopy()) {
      await copyFiles(this.config, elementPath)
    }
  }

  _getMetaTypeFilePath(path: string) {
    const parsedPath = parse(path)
    return join(
      parsedPath.dir,
      `${parsedPath.name}.${this.metadataDef.suffix}${METAFILE_SUFFIX}`
    )
  }

  _parseLine() {
    return this.line.match(
      new RegExp(
        `(?<path>.*[/\\\\]${RegExpEscape(
          this.metadataDef.directoryName
        )})[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
  }

  _isProcessable() {
    return this.metadataDef.suffix === this.ext
  }

  _delegateFileCopy() {
    return true
  }

  _parentFolderIsNotTheType() {
    return this.parentFolder !== this.type
  }
}
