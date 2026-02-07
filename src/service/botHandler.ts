'use strict'
import { parse } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { ManifestTarget } from '../types/handlerResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import ShareFolderHandler from './sharedFolderHandler.js'

const BOT_TYPE = 'Bot'
const BOT_EXTENSION = 'bot'

export default class BotHandler extends ShareFolderHandler {
  protected override _getElementName() {
    const fileName = parse(this.element.basePath).name
    const elementName = new Set([this.element.pathAfterType[0], fileName])
    return [...elementName].join(DOT)
  }

  @log
  public override async handleAddition() {
    await super.handleAddition()
    await this._addParentBot()
  }

  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    const botName = this.element.parentFolder.split(PATH_SEP).pop() as string
    result.manifests.push({
      target: ManifestTarget.Package,
      type: BOT_TYPE,
      member: botName,
    })
    const botPath = `${
      parse(this.element.basePath).dir
    }${PATH_SEP}${botName}.${BOT_EXTENSION}`
    this._collectCopyWithMetaFile(result.copies, botPath)
    return result
  }

  protected async _addParentBot() {
    const botName = this.element.parentFolder.split(PATH_SEP).pop() as string
    fillPackageWithParameter({
      store: this.diffs.package,
      type: BOT_TYPE,
      member: botName,
    })

    if (!this.config.generateDelta) return

    const botPath = `${
      parse(this.element.basePath).dir
    }${PATH_SEP}${botName}.${BOT_EXTENSION}`

    await this._copyWithMetaFile(botPath)
  }
}
