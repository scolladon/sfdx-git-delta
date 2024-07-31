'use strict'
import { format } from 'util'

import messages from '../locales/en'

import StandardHandler from './standardHandler'

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
