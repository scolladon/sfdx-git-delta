'use strict'
import { MASTER_DETAIL_TAG } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { readPathFromGit } from '../utils/fsHelper.js'

import DecomposedHandler from './decomposedHandler.js'
import StandardHandler from './standardHandler.js'

export default class CustomFieldHandler extends DecomposedHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await StandardHandler.prototype.collectAddition.call(this)
    const data = await readPathFromGit(
      { path: this.element.basePath, oid: this.config.to },
      this.config
    )
    if (data.includes(MASTER_DETAIL_TAG)) {
      this._collectParentCopies(result.copies)
    }
    return result
  }
}
