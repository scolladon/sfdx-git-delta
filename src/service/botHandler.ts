'use strict'
import ShareFolderHandler from './sharedFolderHandler'
import { fillPackageWithParameter } from '../utils/packageHelper'
import { parse, sep } from 'path'
import { DOT } from '../utils/fsHelper'

const BOT_TYPE = 'Bot'
const BOT_EXTENSION = 'bot'

export default class BotHandler extends ShareFolderHandler {
  protected override _getElementName() {
    const parsedPath = this._getParsedPath()
    const elementName = new Set([
      parsedPath.dir.split(sep).pop(),
      parsedPath.name,
    ])
    return [...elementName].join(DOT)
  }
  public override async handleAddition() {
    await super.handleAddition()
    await this._addParentBot()
  }

  protected async _addParentBot() {
    const botName = this.parentFolder.split(sep).pop() as string
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
