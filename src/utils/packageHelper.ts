'use strict'
import { create } from 'xmlbuilder2'

import { OBJECT_XML_NAME } from '../constant/metadataConstants'
import { Config } from '../types/config'
import { Manifest } from '../types/work'

const xmlConf = { indent: '    ', newline: '\n', prettyPrint: true }
const frLocale = 'fr'

export default class PackageBuilder {
  // eslint-disable-next-line no-unused-vars
  constructor(protected readonly config: Config) {}

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
    // QUESTION: Why Object needs to be ordered first in package.xml so it can be deployed ?
    if (x === OBJECT_XML_NAME) return -1 // @deprecated To remove when the order will not impact the result of the deployment
    return new Intl.Collator(frLocale).compare(x, y)
  }
}

export const fillPackageWithParameter = ({
  store,
  type,
  member,
}: {
  store: Manifest
  type: string
  member: string
}) => {
  if (!store.has(type)) {
    store.set(type, new Set())
  }
  store.get(type)?.add(member)
}
