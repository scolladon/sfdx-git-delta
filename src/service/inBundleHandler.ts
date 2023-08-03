'use strict'
import InResourceHandler from './inResourceHandler'
import { sep } from 'path'
import { META_REGEX } from '../utils/metadataConstants'
import { cleanUpPackageMember } from '../utils/packageHelper'

export default class BundleHandler extends InResourceHandler {
  constructor(line, type, work, metadata) {
    super(line, type, work, metadata)
  }

  _getElementName() {
    const bundlePath = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .slice(0, 2)

    const packageMember = bundlePath
      .join(sep)
      .replace(META_REGEX, '')
      .replace(this.suffixRegex, '')

    return cleanUpPackageMember(packageMember)
  }
}
