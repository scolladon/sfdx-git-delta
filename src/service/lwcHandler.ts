'use strict'

import InResourceHandler from './inResourceHandler.js'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    return this.element.parentFolder !== this.element.type.directoryName
  }
}
