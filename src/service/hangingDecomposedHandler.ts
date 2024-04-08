'use strict'
import { EXTENSION_SUFFIX_REGEX, PATH_SEP } from '../constant/fsConstants'
import { METAFILE_SUFFIX, META_REGEX } from '../constant/metadataConstants'
import { pathExists } from '../utils/fsHelper'

import StandardHandler from './standardHandler'

export default class HangingDecomposedHandler extends StandardHandler {
  protected override _getElementName() {
    const index = this.line
      .replace(METAFILE_SUFFIX, '')
      .endsWith(`.${this.metadataDef.suffix}`)
      ? this.splittedLine.length - 1
      : this.splittedLine.length - 3

    return this.splittedLine[index]
      .replace(META_REGEX, '')
      .replace(EXTENSION_SUFFIX_REGEX, '')
  }

  public override async handleDeletion() {
    const exists = await pathExists(this._getElementPath(), this.config)
    if (exists) {
      await this.handleModification()
    } else {
      await super.handleDeletion()
    }
  }

  protected _getElementPath() {
    const elementPath = []
    const elementName = this._getElementName()
    for (const pathSegment of this.splittedLine) {
      elementPath.push(pathSegment)
      if (pathSegment === elementName) {
        break
      }
    }
    return elementPath.join(PATH_SEP)
  }

  protected override _isProcessable() {
    return true
  }
}
