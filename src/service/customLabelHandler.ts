'use strict'
import { LABEL_DECOMPOSED_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import InFileHandler from './inFileHandler.js'
import StandardHandler from './standardHandler.js'

export default class CustomLabelHandler extends InFileHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    if (this._isDecomposed()) {
      return await StandardHandler.prototype.collectAddition.call(this)
    }
    return await super.collectAddition()
  }

  protected override _shouldTreatDeletionAsDeletion() {
    return this._isDecomposed()
  }

  protected override _getQualifiedName() {
    return ''
  }

  protected override _delegateFileCopy() {
    return this._isDecomposed()
  }

  protected override _isProcessable() {
    return true
  }

  protected override _shouldTreatContainerType() {
    return false
  }

  protected _isDecomposed() {
    return this.element.extension === LABEL_DECOMPOSED_SUFFIX
  }
}
