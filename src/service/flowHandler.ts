'use strict'

import type { HandlerResult } from '../types/handlerResult.js'
import type ChangeSet from '../utils/changeSet.js'
import { MessageService } from '../utils/MessageService.js'
import StandardHandler from './standardHandler.js'

export default class FlowHandler extends StandardHandler {
  public override async collectDeletion(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    const result = await super.collectDeletion(sink)
    const message = new MessageService()
    result.warnings.push(
      new Error(
        message.getMessage('warning.FlowDeleted', [this._getElementName()])
      )
    )
    return result
  }
}
