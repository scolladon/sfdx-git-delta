/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict'

import { join } from 'path'

import {
  FLOW_DEFINITION_SUFFIX,
  FLOW_DEFINITION_FOLDER,
  FLOW_DEFINITION_TYPE,
  FLOW_XML_NAME,
  METAFILE_SUFFIX,
} from '../constant/metadataConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import type { Work } from '../types/work'
import { writeFile } from '../utils/fsHelper'
import { convertJsonToXml } from '../utils/fxpHelper'
import {
  fillPackageWithParameter,
  removeComponentFromPackage,
} from '../utils/packageHelper'

import BaseProcessor from './baseProcessor'

const getDeactivatedFlowDefinition = () => ({
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  FlowDefinition: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    activeVersionNumber: 0,
  },
})

export default class DeactivateFlowProcessor extends BaseProcessor {
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
  }

  public override async process() {
    if (this._shouldProcess()) {
      const deletedFlows = this.work.diffs.destructiveChanges.get(FLOW_XML_NAME)
      if (deletedFlows) {
        const genericDeactivatedFlowDefinitionXml = convertJsonToXml(
          getDeactivatedFlowDefinition()
        )
        for (const flowName of Array.from(deletedFlows)) {
          // remove Flow from destructiveChanges and add as FlowDefinition to package with generated metadata file
          removeComponentFromPackage({
            store: this.work.diffs.destructiveChanges,
            type: FLOW_XML_NAME,
            member: flowName,
          })
          fillPackageWithParameter({
            store: this.work.diffs.package,
            type: FLOW_DEFINITION_TYPE,
            member: flowName,
          })
          await writeFile(
            join(
              FLOW_DEFINITION_FOLDER,
              `${flowName}.${FLOW_DEFINITION_SUFFIX}.${METAFILE_SUFFIX}`
            ),
            genericDeactivatedFlowDefinitionXml,
            this.config
          )
        }
      }
    }
  }

  _shouldProcess() {
    return (
      this.config.generateDelta &&
      this.work.diffs.destructiveChanges.has(FLOW_DEFINITION_TYPE)
    )
  }
}
