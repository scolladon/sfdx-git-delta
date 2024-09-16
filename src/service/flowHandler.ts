'use strict'

import { MessageService } from '../utils/MessageService.js'
import StandardHandler from './standardHandler.js'

export default class FlowHandler extends StandardHandler {
  public override async handleDeletion() {
    await super.handleDeletion()
    this.warnFlowDeleted()
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
