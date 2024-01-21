'use strict'
import { PATH_SEP } from '../constant/fsConstants'
import InResourceHandler from './inResourceHandler'
import { parse } from 'path'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    const parentFolder = parse(this.line).dir.split(PATH_SEP).pop()

    return parentFolder !== this.type
  }
}
