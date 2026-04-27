'use strict'
import type { Writable } from 'node:stream'

import { OBJECT_TYPE } from '../constant/metadataConstants.js'
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
    })
  }

  protected _buildTypesBlocks(strucDiffPerType: Manifest): TypeBlock[] {
    return Array.from(strucDiffPerType.keys())
      .sort(this._sortTypesWithMetadata)
      .map(metadataType => ({
        members: [...strucDiffPerType.get(metadataType)!].sort(
          collator.compare
        ),
        name: metadataType,
      }))
  }

  _sortTypesWithMetadata = (x: string, y: string) => {
    // RATIONALE: Why must CustomObject be ordered first in package.xml?
    // Deployments fail if dependent objects aren't deployed before their children.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#customobject-ordering
    if (x === OBJECT_TYPE) return -1 // @deprecated To remove when the order will not impact the result of the deployment
    return collator.compare(x, y)
  }
}
