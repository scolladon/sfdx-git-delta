'use strict'
import type { Writable } from 'node:stream'

import type { Config } from '../types/config.js'
import type { Manifest } from '../types/work.js'
import { log } from './LoggingDecorator.js'
import type { RootCapture } from './metadataDiff/xmlEventReader.js'
import { writeXmlDocument } from './metadataDiff/xmlWriter.js'

const frLocale = 'fr'
const collator = new Intl.Collator(frLocale)
const ROOT_ATTRIBUTES = {
  '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
}
const XML_HEADER = {
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
}

type TypeBlock = { members: string[]; name: string }

export default class PackageBuilder {
  constructor(protected readonly config: Config) {}

  @log
  public async buildPackageStream(
    strucDiffPerType: Manifest,
    out: Writable
  ): Promise<void> {
    const typesBlocks = this._buildTypesBlocks(strucDiffPerType)
    const rootChildren: [string, unknown][] = [
      ...typesBlocks.map(block => ['types', block] as [string, unknown]),
      ['version', `${this.config.apiVersion}.0`] as [string, unknown],
    ]
    const capture: RootCapture = {
      xmlHeader: XML_HEADER,
      rootKey: 'Package',
      rootAttributes: ROOT_ATTRIBUTES,
    }
    await writeXmlDocument(out, capture, rootChildren, {
      trailingNewline: false,
      // Member names are raw domain data (from the diff handlers); escape
      // XML-significant characters so the manifest stays valid XML.
      escape: true,
    })
  }

  protected _buildTypesBlocks(strucDiffPerType: Manifest): TypeBlock[] {
    return Array.from(strucDiffPerType.keys())
      .sort(collator.compare)
      .map(metadataType => ({
        members: [...strucDiffPerType.get(metadataType)!].sort(
          collator.compare
        ),
        name: metadataType,
      }))
  }
}
