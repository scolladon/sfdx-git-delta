'use strict'
import { MASTER_DETAIL_TAG } from '../constant/metadataConstants.js'
import { readPathFromGit } from '../utils/fsHelper.js'

import DecomposedHandler from './decomposedHandler.js'

export default class CustomFieldHandler extends DecomposedHandler {
  // QUESTION: Why we need to add parent object for Master Detail field ? https://help.salesforce.com/s/articleView?id=000386883&type=1
  protected override async _copyParent() {
    const data = await readPathFromGit(
      { path: this.element.basePath, oid: this.config.to },
      this.config
    )
    if (!data.includes(MASTER_DETAIL_TAG)) return

    await super._copyParent()
  }
}
