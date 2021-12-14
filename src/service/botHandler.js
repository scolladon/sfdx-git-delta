'use strict'
const WaveHandler = require('./waveHandler')
const path = require('path')

class BotHandler extends WaveHandler {
  _getElementName() {
    const parsedPath = this._getParsedPath()
    const elementName = new Set([
      parsedPath.dir.split(path.sep).pop(),
      parsedPath.name,
    ])
    return [...elementName].join('.')
  }
}

module.exports = BotHandler
