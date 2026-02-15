'use strict'
import { create } from 'xmlbuilder2'

import { OBJECT_TYPE } from '../constant/metadataConstants.js'
import type { Config } from '../types/config.js'
import type { Manifest } from '../types/work.js'
import { log } from './LoggingDecorator.js'

const xmlConf = { indent: '    ', newline: '\n', prettyPrint: true }
const frLocale = 'fr'

export default class PackageBuilder {
  constructor(protected readonly config: Config) {}

  @log
  public buildPackage(strucDiffPerType: Manifest) {
    const xml = create({ version: '1.0', encoding: 'UTF-8' }).ele('Package', {
      xmlns: 'http://soap.sforce.com/2006/04/metadata',
    })
    Array.from(strucDiffPerType.keys())
      .sort(this._sortTypesWithMetadata)
      .forEach(metadataType =>
        [...strucDiffPerType.get(metadataType)!]
          .sort(Intl.Collator(frLocale).compare)
          .reduce((type, member) => {
            type.ele('members').txt(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .txt(metadataType)
      )
    xml.ele('version').txt(`${this.config.apiVersion}.0`)
    return xml.end(xmlConf)
  }

  _sortTypesWithMetadata = (x: string, y: string) => {
    // RATIONALE: Why must CustomObject be ordered first in package.xml?
    // Deployments fail if dependent objects aren't deployed before their children.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#customobject-ordering
    if (x === OBJECT_TYPE) return -1 // @deprecated To remove when the order will not impact the result of the deployment
    return new Intl.Collator(frLocale).compare(x, y)
  }
}
