/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import MetadataDiff from '../../../../src/utils/metadataDiff'
import {
  parseXmlFileToJson,
  convertJsonToXml,
} from '../../../../src/utils/fxpHelper'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'

jest.mock('../../../../src/utils/fxpHelper', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const workFlowAttributes = new Map([
  ['alerts', { xmlName: 'WorkflowAlert', key: 'fullName' }],
])

describe(`MetadataDiff`, () => {
  let metadataDiff: MetadataDiff
  let globalMetadata: MetadataRepository
  let work: Work
  let alert: any, alertOther: any, alertTest: any, wfBase: any, unTracked: any
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  beforeEach(() => {
    jest.resetAllMocks()
    work = getWork()
    work.config.from = 'from'
    work.config.to = 'to'
    metadataDiff = new MetadataDiff(
      work.config,
      globalMetadata,
      workFlowAttributes
    )

    alert = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      Workflow: {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        alerts: [
          {
            fullName: 'TestEmailAlert',
            description: 'awesome',
            protected: 'false',
            recipients: { field: 'OtherEmail', type: 'email' },
            senderAddress: 'awesome@awesome.com',
            senderType: 'OrgWideEmailAddress',
            template: 'None',
          },
          {
            fullName: 'OtherTestEmailAlert',
            description: 'awesome',
            protected: 'false',
            recipients: { field: 'OtherEmail', type: 'email' },
            senderAddress: 'awesome@awesome.com',
            senderType: 'OrgWideEmailAddress',
            template: 'None',
          },
        ],
      },
    }

    alertOther = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      Workflow: {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        alerts: [
          {
            fullName: 'OtherTestEmailAlert',
            description: 'awesome',
            protected: 'false',
            recipients: { field: 'OtherEmail', type: 'email' },
            senderAddress: 'awesome@awesome.com',
            senderType: 'OrgWideEmailAddress',
            template: 'None',
          },
        ],
      },
    }

    alertTest = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      Workflow: {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        alerts: {
          fullName: 'TestEmailAlert',
          description: 'awesome',
          protected: 'false',
          recipients: { field: 'OtherEmail', type: 'email' },
          senderAddress: 'awesome@awesome.com',
          senderType: 'OrgWideEmailAddress',
          template: 'None',
        },
      },
    }

    wfBase = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      Workflow: {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      },
    }

    unTracked = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      Workflow: {
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        unTracked: {
          fullName: 'untracked',
        },
      },
    }
  })

  describe('compare', () => {
    it('does not detect null file content', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce('')
      mockedParseXmlFileToJson.mockResolvedValueOnce('')

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.size).toBe(0)
    })

    it('does not detect not tracked elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(unTracked)
      mockedParseXmlFileToJson.mockResolvedValueOnce(wfBase)

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.size).toBe(0)
    })

    it('detects added elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(alert)
      mockedParseXmlFileToJson.mockResolvedValueOnce(wfBase)

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.get('WorkflowAlert')).toEqual(
        new Set(['OtherTestEmailAlert', 'TestEmailAlert'])
      )
    })
    it('detects removed elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(wfBase)
      mockedParseXmlFileToJson.mockResolvedValueOnce(alert)

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(added.size).toBe(0)
      expect(deleted.get('WorkflowAlert')).toEqual(
        new Set(['OtherTestEmailAlert', 'TestEmailAlert'])
      )
    })

    it('detects deleted file', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce('')
      mockedParseXmlFileToJson.mockResolvedValueOnce(alert)

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(added.size).toBe(0)
      expect(deleted.get('WorkflowAlert')).toEqual(
        new Set(['OtherTestEmailAlert', 'TestEmailAlert'])
      )
    })

    it('detects modified elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(alertTest)
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...alertTest,
        Workflow: {
          ...alertTest.Workflow,
          alerts: { ...alertTest.Workflow.alerts, description: 'amazing' },
        },
      })

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.get('WorkflowAlert')).toEqual(new Set(['TestEmailAlert']))
    })
  })
  describe('prune', () => {
    it('given one element added, the generated file contains only this element', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(alert)
      mockedParseXmlFileToJson.mockResolvedValueOnce(alertTest)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alertOther)
      expect(isEmpty).toBe(false)
    })
    it('given every element deleted, the generated file is empty', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(alertTest)
      mockedParseXmlFileToJson.mockResolvedValueOnce(alert)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...wfBase,
        Workflow: {
          ...wfBase.Workflow,
          alerts: [],
        },
      })
      expect(isEmpty).toBe(true)
    })
    it('given file contains only new element, it keeps the file identical', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(alert)
      mockedParseXmlFileToJson.mockResolvedValueOnce(wfBase)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alert)
      expect(isEmpty).toBe(false)
    })

    it('given one element modified, the generated file contains only this element', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(alertOther)
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...alertOther,
        Workflow: {
          ...alertOther.Workflow,
          alerts: { ...alertOther.Workflow.alerts, description: 'amazing' },
        },
      })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alertOther)
      expect(isEmpty).toBe(false)
    })

    it('given untracked element, nothing trackable changed, the generated file contains untracked elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce(unTracked)
      mockedParseXmlFileToJson.mockResolvedValueOnce(wfBase)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(unTracked)
      expect(isEmpty).toBe(false)
    })
  })
})
