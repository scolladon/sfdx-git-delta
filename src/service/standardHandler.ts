'use strict'
import { readFileSync } from 'fs'
import { join, parse, ParsedPath, sep } from 'path'
import { copySync, CopyOptionsSync, pathExistsSync } from 'fs-extra'
import { GIT_DIFF_TYPE_REGEX, UTF8_ENCODING } from '../utils/gitConstants'
import { META_REGEX, METAFILE_SUFFIX } from '../utils/metadataConstants'
import { MetadataRepository } from '../model/Metadata'
import { Deploy, Result } from '../model/Result'
import { Config } from '../model/Config'
import { Package } from '../model/Package'

const COPYSYNC_OPTION: CopyOptionsSync = {
  overwrite: true,
  errorOnExist: false,
  dereference: true,
  preserveTimestamps: false,
}

const copiedFiles: Set<string> = new Set()

type GitChange = 'A' | 'D' | 'M'

type HandlerMap = {
  A: () => void
  D: () => void
  M: () => void
}

export default class StandardHandler {
  protected readonly config: Config
  protected readonly diffs: Deploy
  protected readonly line: string
  protected readonly type: string
  protected readonly splittedLine: Array<string>
  protected suffixRegex: RegExp

  private readonly changeType: GitChange
  private readonly handlerMap: HandlerMap
  private readonly warnings: Array<string>

  protected static metadata: MetadataRepository
  private static PACKAGE_MEMBER_PATH_SEP: string = '/'
  public static cleanUpPackageMember(packageMember: string): string {
    return `${packageMember}`.replace(
      /\\+/g,
      StandardHandler.PACKAGE_MEMBER_PATH_SEP
    )
  }

  constructor(
    line: string,
    type: string,
    work: Result,
    metadata: MetadataRepository
  ) {
    StandardHandler.metadata = StandardHandler.metadata ?? metadata
    this.changeType = line[0] as GitChange
    this.line = line.replace(GIT_DIFF_TYPE_REGEX, '')
    this.type = type
    this.diffs = work.diffs
    this.config = work.config
    this.splittedLine = this.line.split(sep)
    this.warnings = work.warnings

    if (StandardHandler.metadata[this.type].metaFile === true) {
      this.line = this.line.replace(METAFILE_SUFFIX, '')
    }

    this.suffixRegex = new RegExp(
      `\\.${StandardHandler.metadata[this.type].suffix}$`
    )

    this.handlerMap = {
      A: this.handleAddition,
      D: this.handleDeletion,
      M: this.handleModification,
    }
  }

  public handle(): void {
    if (this.handlerMap[this.changeType]) {
      try {
        this.handlerMap[this.changeType].apply(this)
      } catch (error) {
        error.message = `${this.line}: ${error.message}`
        this.warnings.push(error)
      }
    }
  }

  public handleAddition(): void {
    this.fillPackage(this.diffs.package)
    if (!this.config.generateDelta) return

    const source = join(this.config.repo, this.line)
    const target = join(this.config.output, this.line)

    this.copyFiles(source, target)
    if (StandardHandler.metadata[this.type].metaFile === true) {
      this.copyFiles(source + METAFILE_SUFFIX, target + METAFILE_SUFFIX)
    }
  }

  protected handleDeletion(): void {
    this.fillPackage(this.diffs.destructiveChanges)
  }

  protected handleModification(): void {
    this.handleAddition()
  }

  protected getParsedPath(): ParsedPath {
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

  protected getElementName(): string {
    const parsedPath = this.getParsedPath()
    return StandardHandler.cleanUpPackageMember(parsedPath.base)
  }

  protected fillPackage(packageObject: Package): void {
    packageObject[this.type] = packageObject[this.type] ?? new Set()
    packageObject[this.type].add(this.getElementName())
  }

  protected copyFiles(src: string, dst: string): void {
    if (!copiedFiles.has(src) && pathExistsSync(src)) {
      copySync(src, dst, COPYSYNC_OPTION)
      copiedFiles.add(src)
    }
  }

  protected readFileSync(): string {
    return readFileSync(join(this.config.repo, this.line), {
      encoding: UTF8_ENCODING,
    })
  }
}
