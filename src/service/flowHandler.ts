'use strict'
import { format } from 'node:util'

import messages from '../locales/en.js'

import StandardHandler from './standardHandler.js'

export default class FlowHandler extends StandardHandler {
  public override async handleDeletion() {
    await super.handleDeletion()
    this.warnFlowDeleted()
  }

  private warnFlowDeleted() {
    this.work.warnings.push(
      new Error(format(messages.warningFlowDeleted, this._getElementName()))
    )
  }
}
