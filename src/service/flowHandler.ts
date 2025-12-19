'use strict'

import { FLOW_XML_NAME } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'
import type { Work } from '../types/work.js'
import { log } from '../utils/LoggingDecorator.js'
import { MessageService } from '../utils/MessageService.js'
import { fillPackageWithParameter } from '../utils/packageHelper.js'
import StandardHandler from './standardHandler.js'

export default class FlowHandler extends StandardHandler {
  private readonly messageService: MessageService

  constructor(
    line: string,
    metadataDef: Metadata,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, metadataDef, work, metadata)
    this.messageService = new MessageService()
  }

  @log
  public override async handleDeletion() {
    try {
      const flowName = this._getElementName()
      const destructiveChanges = this.diffs.destructiveChanges

      // Add each flow 50 times with "-n" appended
      for (let i = 1; i <= 50; i++) {
        const flowWithSuffix = `${flowName}-${i}`
        fillPackageWithParameter({
          store: destructiveChanges,
          type: FLOW_XML_NAME,
          member: flowWithSuffix,
        })
      }

      // Log a single warning for the flow
      this.warnFlowDeleted(flowName)
    } catch (error) {
      if (error instanceof Error) {
        error.message = `${this.line}: ${error.message}`
        this.warnings.push(error)
      }
    }
  }

  private warnFlowDeleted(flowName: string) {
    this.work.warnings.push(
      new Error(
        this.messageService.getMessage('warning.FlowDeleted', [flowName])
      )
    )
  }
}
