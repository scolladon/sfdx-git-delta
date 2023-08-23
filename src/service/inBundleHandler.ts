'use strict'
import InResourceHandler from './inResourceHandler'
import { sep } from 'path'
import { META_REGEX } from '../utils/metadataConstants'
import { cleanUpPackageMember } from '../utils/packageHelper'
import { Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'

export default class BundleHandler extends InResourceHandler {
  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
  }

  _getElementName() {
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
