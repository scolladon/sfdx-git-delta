'use strict'
import * as xmlBuilder from 'xmlbuilder'
import { Config } from '../model/Config'
import { WAVE_SUB_TYPES_PREFIX } from './metadataConstants'
import { MetadataRepository } from '../model/Metadata'
import { Package } from '../model/Package'

const xmlConf = { indent: '    ', newline: '\n', pretty: true }

type Package = {
  [key: string]: Set<string>
}

export class PackageConstructor {
  config: Config
  metadata: MetadataRepository

  constructor(config: Config, metadata: {}) {
    this.config = config
    this.metadata = metadata
  }

  constructPackage(strucDiffPerType: Package) {
    if (!strucDiffPerType) {
      return
    }

    const xml = getXML()
    Object.keys(strucDiffPerType)
      // Here type is what is in the array
      .filter(
        type =>
          Object.prototype.hasOwnProperty.call(this.metadata, type) ||
          type.startsWith(WAVE_SUB_TYPES_PREFIX)
      )
      .sort()
      // @deprecated To remove when the order will not impact the result of the deployment
      .sort((x, y) => (x === 'objects' ? -1 : x.localeCompare(y)))
      .forEach((metadataType: string) =>
        [...strucDiffPerType[metadataType]] // transform set to array
          .reduce((type, member) => {
            type.ele('members').t(member)
            return type
          }, xml.ele('types'))
          .ele('name')
          .t(this.metadata[metadataType]?.xmlName ?? metadataType)
      )
    xml.ele('version').t(`${this.config.apiVersion}.0`)
    return xml.end(xmlConf)
  }
}

const getXML = () =>
  xmlBuilder
    .create('Package')
    .att('xmlns', 'http://soap.sforce.com/2006/04/metadata')
    .dec('1.0', 'UTF-8')
