'use strict'
import { PATH_SEP } from '../constant/fsConstants'
import { META_REGEX } from '../constant/metadataConstants'

import InResourceHandler from './inResourceHandler'

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const bundlePath: string[] = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .slice(0, 2)

    return bundlePath
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(this.suffixRegex, '')
  }
}
