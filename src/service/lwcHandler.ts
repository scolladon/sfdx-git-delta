'use strict'
import InResourceHandler from './inResourceHandler'
import { parse, sep } from 'path'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    const parentFolder = parse(this.line).dir.split(sep).pop()

    return parentFolder !== this.type
  }
}
