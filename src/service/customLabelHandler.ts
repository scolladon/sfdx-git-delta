'use strict'
import { LABEL_DECOMPOSED_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import type ChangeSet from '../utils/changeSet.js'
import InFileHandler from './inFileHandler.js'
import StandardHandler from './standardHandler.js'

export default class CustomLabelHandler extends InFileHandler {
  public override async collectAddition(
    sink?: ChangeSet
  ): Promise<HandlerResult> {
    if (this._isDecomposed()) {
      return await StandardHandler.prototype.collectAddition.call(this, sink)
    }
    return await super.collectAddition(sink)
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

  // Stryker disable next-line BlockStatement -- equivalent: returning undefined is falsy, identical to returning false in the if-check that consumes this method
  protected override _collectsContainer() {
    return false
  }

  protected _isDecomposed() {
    return this.element.extension === LABEL_DECOMPOSED_SUFFIX
  }
}
