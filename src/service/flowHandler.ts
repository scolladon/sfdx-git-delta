'use strict'

import type { HandlerResult } from '../types/handlerResult.js'
import { MessageService } from '../utils/MessageService.js'
import StandardHandler from './standardHandler.js'

export default class FlowHandler extends StandardHandler {
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
}
