'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getInFileAttributes } from '../../../../src/metadata/metadataManager'
import { SharedFileMetadata } from '../../../../src/types/metadata'
import type { Work } from '../../../../src/types/work'
import {
  convertJsonToXml,
  parseXmlFileToJson,
} from '../../../../src/utils/fxpHelper'
import MetadataDiff from '../../../../src/utils/metadataDiff'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fxpHelper', () => {
  const actualModule: any = jest.requireActual(
    '../../../../src/utils/fxpHelper'
  )
  return {
    ...actualModule,
    parseXmlFileToJson: jest.fn(),
    convertJsonToXml: jest.fn(),
  }
})
const mockedParseXmlFileToJson = jest.mocked(parseXmlFileToJson)

const xmlHeader = { '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' } }

interface Alert {
  fullName: string
  description: string
  protected: string
  recipients: {
    field: string
    type: string
  }
  senderAddress: string
  senderType: string
  template: string
}

function makeWorkflow(alerts: Alert[]) {
  return {
    Workflow: {
      '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      alerts,
    },
  }
}

function makeAlertWorkflow(recordCount = 1000) {
  const alerts: Alert[] = []
  for (let i = 0; i < recordCount; i++) {
    alerts.push({
      fullName: `TestEmailAlert${i}`,
      description: `awesome${i}`,
      protected: 'false',
      recipients: { field: 'OtherEmail', type: 'email' },
      senderAddress: 'awesome@awesome.com',
      senderType: 'OrgWideEmailAddress',
      template: 'None',
    })
  }

  return makeWorkflow(alerts)
}

describe(`MetadataDiffLarge`, () => {
  let metadataDiff: MetadataDiff
  let globalMetadata: MetadataRepository
  let inFileAttribute: Map<string, SharedFileMetadata>
  let work: Work
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
    inFileAttribute = getInFileAttributes(globalMetadata)
  })
  beforeEach(() => {
    jest.resetAllMocks()
    work = getWork()
    work.config.from = 'from'
    work.config.to = 'to'
    metadataDiff = new MetadataDiff(work.config, inFileAttribute)
  })

  describe(`When prune is called with 2 alert workflows where one has an extra alert`, () => {
    it('Returns only the extra alert', async () => {
      // Arrange
      const baseWorkflow = makeAlertWorkflow()
      const modifiedWorkflow = structuredClone(baseWorkflow)
      const extraAlert = {
        fullName: 'AlertTest1',
        description: 'alert-test-1',
        protected: 'false',
        recipients: { field: 'OtherEmail', type: 'email' },
        senderAddress: 'awesome@awesome.com',
        senderType: 'OrgWideEmailAddress',
        template: 'None',
      }
      modifiedWorkflow.Workflow.alerts.push(extraAlert)
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...modifiedWorkflow,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...baseWorkflow,
      })

      // Act
      await metadataDiff.compare('file/path')
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        ...makeWorkflow([extraAlert]),
      })
      expect(isEmpty).toBe(false)
    })
  })
})
