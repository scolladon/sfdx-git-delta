'use strict'
import { parse } from 'path/posix'

import { PATH_SEP } from '../constant/fsConstants'

import InResourceHandler from './inResourceHandler'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    const parentFolder = parse(this.line).dir.split(PATH_SEP).pop()

    return parentFolder !== this.metadataDef.directoryName
  }
}
