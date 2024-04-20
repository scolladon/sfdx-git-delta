'use strict'
import { LABEL_DECOMPOSED_SUFFIX } from '../constant/metadataConstants'

import InFileHandler from './inFileHandler'
import StandardHandler from './standardHandler'

export default class CustomLabelHandler extends InFileHandler {
  public override async handleAddition() {
    if (this._isDecomposed()) {
      await StandardHandler.prototype.handleAddition.apply(this)
    } else {
      await super.handleAddition()
    }
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
    // There is no container / parent type for Contained CustomLabels
    return false
  }

  protected _isDecomposed() {
    return this.ext === LABEL_DECOMPOSED_SUFFIX
  }
}
