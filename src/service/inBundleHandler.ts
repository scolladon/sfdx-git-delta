'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import { META_REGEX } from '../constant/metadataConstants.js'

import InResourceHandler from './inResourceHandler.js'

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const suffixRegex = new RegExp(`\\.${this.element.type.suffix}$`)
    return this.element.pathAfterType
      .slice(0, 2)
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(suffixRegex, '')
  }
}
