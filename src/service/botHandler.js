'use strict'
const WaveHandler = require('./waveHandler')
const path = require('path')

const BOT_TYPE = 'Bot'
const BOT_EXTENSION = 'bot'

class BotHandler extends WaveHandler {
  _getElementName() {
    const parsedPath = this._getParsedPath()
    const elementName = new Set([
      parsedPath.dir.split(path.sep).pop(),
      parsedPath.name,
    ])
    return [...elementName].join('.')
  }
  async handleAddition() {
    super.handleAddition()

    const botName = this._getParsedPath().dir.split(path.sep).pop()
    this._fillPackageWithParameter({
      package: this.diffs.package,
      type: BOT_TYPE,
      elementName: botName,
    })

    const botPath = `${path.parse(this.line).dir}${
      path.sep
    }${botName}.${BOT_EXTENSION}`
    const source = path.join(this.config.repo, botPath)
    const target = path.join(this.config.output, botPath)

    await this._copyWithMetaFile(source, target)
  }
}

module.exports = BotHandler
