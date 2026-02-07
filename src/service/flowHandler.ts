'use strict'

import type { HandlerResult } from '../types/handlerResult.js'
import { log } from '../utils/LoggingDecorator.js'
import { MessageService } from '../utils/MessageService.js'
import StandardHandler from './standardHandler.js'

export default class FlowHandler extends StandardHandler {
  @log
  public override async handleDeletion() {
    await super.handleDeletion()
    this.warnFlowDeleted()
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    const result = await super.collectDeletion()
    const message = new MessageService()
    result.warnings.push(
      new Error(
        message.getMessage('warning.FlowDeleted', [this._getElementName()])
      )
    )
    return result
  }

  private warnFlowDeleted() {
    const message = new MessageService()
    this.work.warnings.push(
      new Error(
        message.getMessage('warning.FlowDeleted', [this._getElementName()])
      )
    )
  }
}
