'use strict'
import { XMLBuilder } from 'fast-xml-parser'

import { OBJECT_TYPE } from '../constant/metadataConstants.js'
import type { Config } from '../types/config.js'
import type { Manifest } from '../types/work.js'
import { log } from './LoggingDecorator.js'
import { ATTRIBUTE_PREFIX, XML_HEADER_ATTRIBUTE_KEY } from './xmlHelper.js'

const frLocale = 'fr'
const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: '    ',
  suppressEmptyNode: false,
  suppressBooleanAttributes: false,
  processEntities: false,
})

export default class PackageBuilder {
  constructor(protected readonly config: Config) {}

  @log
  public buildPackage(strucDiffPerType: Manifest) {
    const types = Array.from(strucDiffPerType.keys())
      .sort(this._sortTypesWithMetadata)
      .map(metadataType => ({
        members: [...strucDiffPerType.get(metadataType)!].sort(
          Intl.Collator(frLocale).compare
        ),
        name: metadataType,
      }))

    const jsonObj = {
      [XML_HEADER_ATTRIBUTE_KEY]: {
        [`${ATTRIBUTE_PREFIX}version`]: '1.0',
        [`${ATTRIBUTE_PREFIX}encoding`]: 'UTF-8',
      },
      Package: {
        [`${ATTRIBUTE_PREFIX}xmlns`]: 'http://soap.sforce.com/2006/04/metadata',
        ...(types.length > 0 ? { types } : {}),
        version: `${this.config.apiVersion}.0`,
      },
    }

    return xmlBuilder.build(jsonObj).trimEnd()
  }

  _sortTypesWithMetadata = (x: string, y: string) => {
    // RATIONALE: Why must CustomObject be ordered first in package.xml?
    // Deployments fail if dependent objects aren't deployed before their children.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#customobject-ordering
    if (x === OBJECT_TYPE) return -1 // @deprecated To remove when the order will not impact the result of the deployment
    return new Intl.Collator(frLocale).compare(x, y)
  }
}
