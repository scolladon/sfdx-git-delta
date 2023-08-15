'use strict'
const SharedFolderHandler = require('./sharedFolderHandler')
const { fillPackageWithParameter } = require('../utils/packageHelper')
const { parse, sep } = require('path')

const BOT_TYPE = 'Bot'
const BOT_EXTENSION = 'bot'

class BotHandler extends SharedFolderHandler {
  _getElementName() {
    const parsedPath = this._getParsedPath()
    const elementName = new Set([
      parsedPath.dir.split(sep).pop(),
      parsedPath.name,
    ])
    return [...elementName].join('.')
  }
  async handleAddition() {
    await super.handleAddition()
    await this._addParentBot()
  }

  async _addParentBot() {
    const botName = this.parentFolder.split(sep).pop()
    fillPackageWithParameter({
      store: this.diffs.package,
      type: BOT_TYPE,
      member: botName,
    })

    if (!this.config.generateDelta) return

    const botPath = `${parse(this.line).dir}${sep}${botName}.${BOT_EXTENSION}`

    await this._copyWithMetaFile(botPath)
  }
}

module.exports = BotHandler
