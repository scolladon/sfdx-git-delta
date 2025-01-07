'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import { META_REGEX } from '../constant/metadataConstants.js'

import InResourceHandler from './inResourceHandler.js'

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const bundlePath: string[] = this.splittedLine
      .slice(this.splittedLine.indexOf(this.metadataDef.directoryName) + 1)
      .slice(0, 2)

    return bundlePath
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(this.suffixRegex, '')
  }
}
