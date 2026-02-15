'use strict'
import { MASTER_DETAIL_TAG } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { contentIncludes } from '../utils/fsHelper.js'

import DecomposedHandler from './decomposedHandler.js'
import StandardHandler from './standardHandler.js'

export default class CustomFieldHandler extends DecomposedHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await StandardHandler.prototype.collectAddition.call(this)
    // RATIONALE: Why include parent object when deploying Master Detail fields?
    // Master Detail fields require their parent object to exist; deployment fails otherwise.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#master-detail-fields
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
