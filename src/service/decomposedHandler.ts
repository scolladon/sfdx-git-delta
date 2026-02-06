'use strict'
import { join } from 'node:path/posix'

import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'

export default class DecomposedHandler extends StandardHandler {
  @log
  public override async handleAddition() {
    await this._resolveMetadata()
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._copyParent()
  }

  protected async _copyParent() {
    const parentDirPath = this.splittedLine
      .slice(0, this._getDirectoryIndex())
      .join(PATH_SEP)
    const parentTypeName = this.getParentName()

    const parentTypeSuffix = this.metadata.get(
      this.metadataDef.parentXmlName!
    )!.suffix

    const parentPath = join(
      parentDirPath,
      `${parentTypeName}.${parentTypeSuffix}${METAFILE_SUFFIX}`
    )

    await this._copyWithMetaFile(parentPath)
  }

  protected override _getElementName() {
    const parentTypeSuffix = this.getParentName()
    const elementName = super._getElementName()
    return `${parentTypeSuffix}.${elementName}`
  }

  protected getParentName() {
    return this.splittedLine[this._getDirectoryIndex() - 1]
  }

  protected _getDirectoryIndex(): number {
    // For decomposed types, boundaryIndex points to the file itself,
    // the directory containing it is one level up
    if (this.resolvedMetadata) {
      // Find the directoryName in path for parent calculation
      const dirIndex = this.splittedLine.indexOf(this.metadataDef.directoryName)
      if (dirIndex >= 0) {
        return dirIndex
      }
      // Fallback: directoryName is 2 levels up from the component
      return this.resolvedMetadata.boundaryIndex - 1
    }
    return this.splittedLine.indexOf(this.metadataDef.directoryName)
  }
}
