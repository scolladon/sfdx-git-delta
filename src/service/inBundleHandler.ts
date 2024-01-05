'use strict'
import InResourceHandler from './inResourceHandler'
import { sep } from 'path'
import { META_REGEX } from '../constant/metadataConstants'
import { cleanUpPackageMember } from '../utils/packageHelper'

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const bundlePath: string[] = this.splittedLine
      .slice(this.splittedLine.indexOf(this.type) + 1)
      .slice(0, 2)

    const packageMember: string = bundlePath
      .join(sep)
      .replace(META_REGEX, '')
      .replace(this.suffixRegex, '')

    return cleanUpPackageMember(packageMember)
  }
}
