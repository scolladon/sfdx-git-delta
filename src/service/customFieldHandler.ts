'use strict'
import { MASTER_DETAIL_TAG } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { contentIncludes } from '../utils/fsHelper.js'

import DecomposedHandler from './decomposedHandler.js'
import StandardHandler from './standardHandler.js'

export default class CustomFieldHandler extends DecomposedHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await StandardHandler.prototype.collectAddition.call(this)
    const isMasterDetail = await contentIncludes(
      MASTER_DETAIL_TAG,
      this.element.basePath,
      this.config
    )
    if (isMasterDetail) {
      this._collectParentCopies(result.copies)
    }
    return result
  }
}
