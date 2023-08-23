'use strict'
import StandardHandler from './standardHandler'
import { join, parse, sep } from 'path'
import { pathExists } from '../utils/fsHelper'
import { META_REGEX, METAFILE_SUFFIX } from '../utils/metadataConstants'
import { cleanUpPackageMember } from '../utils/packageHelper'
import { DOT } from '../utils/fsHelper'
import { Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'

export default class ResourceHandler extends StandardHandler {
  metadataName: string

  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
    this.metadataName = this._getMetadataName()
  }

  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return

    if (this.line !== this.metadataName && this._parentFolderIsNotTheType()) {
      await this._copy(this.metadataName)
    }
  }

  async handleDeletion() {
    const [, elementPath, elementName] = this._parseLine()!
    const exists = await pathExists(join(elementPath, elementName), this.config)
    if (exists) {
      await this.handleModification()
    } else {
      super.handleDeletion()
    }
  }

  _getElementName() {
    const parsedPath = this._getParsedPath()
    return cleanUpPackageMember(parsedPath.name)
  }

  _getParsedPath() {
    return parse(
      this.splittedLine[this.splittedLine.indexOf(this.type) + 1]
        .replace(META_REGEX, '')
        .replace(this.suffixRegex, '')
    )
  }

  _isProcessable() {
    return true
  }

  _getMetadataName() {
    const resourcePath = []
    for (const pathElement of this.splittedLine) {
      if (resourcePath.slice(-2)[0] === this.type) {
        break
      }
      resourcePath.push(pathElement)
    }
    let lastPathElement = resourcePath[resourcePath.length - 1].split(DOT)
    if (lastPathElement.length > 1) {
      lastPathElement.pop()
    }

    resourcePath[resourcePath.length - 1] = lastPathElement.join(DOT)
    return `${resourcePath.join(sep)}`
  }

  _getMetaTypeFilePath() {
    return `${this.metadataName}.${this.metadataDef.suffix}${METAFILE_SUFFIX}`
  }
}
