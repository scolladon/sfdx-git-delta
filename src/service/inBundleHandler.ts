'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import { META_REGEX } from '../constant/metadataConstants.js'

import InResourceHandler from './inResourceHandler.js'

const suffixRegexCache = new Map<string, RegExp>()

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const suffix = this.element.type.suffix!
    let suffixRegex = suffixRegexCache.get(suffix)
    if (!suffixRegex) {
      suffixRegex = new RegExp(`\\.${suffix}$`)
      suffixRegexCache.set(suffix, suffixRegex)
    }
    return this.element.pathAfterType
      .slice(0, 2)
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(suffixRegex, '')
  }
}
