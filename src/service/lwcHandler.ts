'use strict'
import { parse } from 'node:path/posix'

import { PATH_SEP } from '../constant/fsConstants.js'

import InResourceHandler from './inResourceHandler.js'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    const parentFolder = parse(this.line).dir.split(PATH_SEP).pop()

    return parentFolder !== this.metadataDef.directoryName
  }
}
