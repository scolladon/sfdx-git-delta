'use strict'
import StandardHandler from './standardHandler'
import {
  INFOLDER_SUFFIX,
  METAFILE_SUFFIX,
  META_REGEX,
} from '../utils/metadataConstants'
import { join, normalize, sep } from 'path'
import { Package } from '../model/Package'

const INFOLDER_SUFFIX_REGEX: RegExp = new RegExp(`${INFOLDER_SUFFIX}$`)
const EXTENSION_SUFFIX_REGEX: RegExp = new RegExp(/\.[^/.]+$/)
export default class InFolderHandler extends StandardHandler {
  override handleAddition(): void {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const regexRepo = this.config.repo !== '.' ? this.config.repo : ''

    const parsedResult: RegExpMatchArray | null = join(
      this.config.repo,
      this.line
    ).match(
      new RegExp(
        `(${RegExpEscape(regexRepo)})(?<path>.*[/\\\\]${RegExpEscape(
          StandardHandler.metadata[this.type].directoryName
        )})[/\\\\](?<name>[^/\\\\]*)+`,
        'u'
      )
    )
    if (parsedResult === null) return
    let [, , folderPath, folderName] = parsedResult
    folderName = `${folderName}.${
      StandardHandler.metadata[this.type].xmlName.toLowerCase() +
      INFOLDER_SUFFIX +
      METAFILE_SUFFIX
    }`

    this.copyFiles(
      normalize(join(this.config.repo, folderPath, folderName)),
      normalize(join(this.config.output, folderPath, folderName))
    )
  }

  override fillPackage(packageObject: Package): void {
    packageObject[this.type] = packageObject[this.type] ?? new Set()

    const packageMember = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .join(sep)
      .replace(META_REGEX, '')
      .replace(INFOLDER_SUFFIX_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')

    packageObject[this.type].add(
      StandardHandler.cleanUpPackageMember(packageMember)
    )
  }
}

const RegExpEscape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
