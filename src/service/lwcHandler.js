'use strict'
const InResourceHandler = require('./inResourceHandler')
const { parse, sep } = require('path')

class LwcHandler extends InResourceHandler {
  _isProcessable() {
    const parentFolder = parse(this.line).dir.split(sep).pop()

    return parentFolder !== this.type
  }
}

module.exports = LwcHandler
