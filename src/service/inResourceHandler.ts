'use strict'
import StandardHandler from './standardHandler'
import { join, parse, sep } from 'path'
import { pathExists, DOT } from '../utils/fsHelper'
import { META_REGEX, METAFILE_SUFFIX } from '../utils/metadataConstants'
import { cleanUpPackageMember } from '../utils/packageHelper'
import { Work } from '../types/work'
import { MetadataRepository } from '../metadata/MetadataRepository'

export default class ResourceHandler extends StandardHandler {
  protected readonly metadataName: string

  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
    this.metadataName = this._getMetadataName()
  }

  public override async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    if (this.line !== this.metadataName && this._parentFolderIsNotTheType()) {
      await this._copy(this.metadataName)
    }
  }

  public override async handleDeletion() {
    const [, elementPath, elementName] = this._parseLine()!
    const exists = await pathExists(join(elementPath, elementName), this.config)
    if (exists) {
      await this.handleModification()
    } else {
      super.handleDeletion()
    }
  }

  protected override _getElementName() {
    const parsedPath = this._getParsedPath()
    return cleanUpPackageMember(parsedPath.name)
  }

  protected override _getParsedPath() {
    return parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  protected override _isProcessable() {
    return true
  }

  protected _getMetadataName() {
    const resourcePath = []
    for (const pathElement of this.splittedLine) {
      if (resourcePath.slice(-2)[0] === this.type) {
        break
      }
      resourcePath.push(pathElement)
    }
    const lastPathElement = resourcePath[resourcePath.length - 1].split(DOT)
    if (lastPathElement.length > 1) {
      lastPathElement.pop()
    }

    resourcePath[resourcePath.length - 1] = lastPathElement.join(DOT)
    return `${resourcePath.join(sep)}`
  }

  protected override _getMetaTypeFilePath() {
    return `${this.metadataName}.${this.metadataDef.suffix}${METAFILE_SUFFIX}`
  }
}
