'use strict'

import {
  type CopyOperation,
  CopyOperationKind,
} from '../types/handlerResult.js'
import InResourceHandler from './inResourceHandler.js'

export default class LwcHandler extends InResourceHandler {
  protected override _isProcessable() {
    return this.element.parentFolder !== this.element.type.directoryName
  }

  protected override _collectResourceCopies(copies: CopyOperation[]): void {
    super._collectResourceCopies(copies)
    if (!this._shouldCollectCopies()) return
    copies.push({
      kind: CopyOperationKind.GitTypeDirCompanionCopy,
      path: this.element.typeDirectoryPath,
      revision: this.config.to,
    })
  }
}
