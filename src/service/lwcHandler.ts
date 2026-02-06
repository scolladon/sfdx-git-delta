'use strict'
import { parse } from 'node:path/posix'

import { PATH_SEP } from '../constant/fsConstants.js'

import InResourceHandler from './inResourceHandler.js'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    // Use resolver metadata if available - if found, it's a component file
    if (this.resolvedMetadata) {
      return true
    }

    // Fallback: check if parent folder is not the directoryName
    // (files directly in lwc folder like .eslintrc.json should be skipped)
    const parentFolder = parse(this.line).dir.split(PATH_SEP).pop()
    return parentFolder !== this.metadataDef.directoryName
  }
}
