'use strict'
import { parse } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'

import ShareFolderHandler from './sharedFolderHandler.js'

const BOT_TYPE = 'Bot'
const BOT_EXTENSION = 'bot'

export default class BotHandler extends ShareFolderHandler {
  protected override _getElementName() {
    const parsedPath = this._getParsedPath()
    const elementName = new Set([
      parsedPath.dir.split(PATH_SEP).pop(),
      parsedPath.name,
    ])
    return [...elementName].join(DOT)
  }
  public override async handleAddition() {
    await super.handleAddition()
    await this._addParentBot()
  }

  protected async _addParentBot() {
    const botName = this.parentFolder.split(PATH_SEP).pop() as string
    fillPackageWithParameter({
      store: this.diffs.package,
      type: BOT_TYPE,
      member: botName,
    })

    if (!this.config.generateDelta) return

    const botPath = `${
      parse(this.line).dir
    }${PATH_SEP}${botName}.${BOT_EXTENSION}`

    await this._copyWithMetaFile(botPath)
  }
}
