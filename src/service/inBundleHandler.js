'use strict'
const InResourceHandler = require('./inResourceHandler')
const { sep } = require('path')
const { META_REGEX } = require('../utils/metadataConstants')
const { cleanUpPackageMember } = require('../utils/packageHelper')

class BundleHandler extends InResourceHandler {
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

module.exports = BundleHandler
