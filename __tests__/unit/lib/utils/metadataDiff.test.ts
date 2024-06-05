/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import type { Work } from '../../../../src/types/work'
import {
  parseXmlFileToJson,
  convertJsonToXml,
} from '../../../../src/utils/fxpHelper'
import MetadataDiff from '../../../../src/utils/metadataDiff'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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

const xmlHeader = { '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' } }

const alert = {
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

const alertOther = {
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

const alertTest = {
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

const wfBase = {
  Workflow: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
  },
}

const unTracked = {
  Workflow: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    unTracked: {
      fullName: 'untracked',
    },
  },
}

describe.each([[{}], [xmlHeader]])(`MetadataDiff`, header => {
  let metadataDiff: MetadataDiff
  let globalMetadata: MetadataRepository
  let work: Work
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })
  beforeEach(() => {
    jest.resetAllMocks()
    work = getWork()
    work.config.from = 'from'
    work.config.to = 'to'
    metadataDiff = new MetadataDiff(work.config, globalMetadata)
  })

  describe(`compare with ${JSON.stringify(header)} header`, () => {
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
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...unTracked,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.size).toBe(0)
    })

    it('detects added elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })

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
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })

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
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })

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
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...alertTest,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
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
  describe(`prune with ${JSON.stringify(header)} header`, () => {
    it('given one element added, the generated file contains only this element', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...alertTest,
      })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...header,
        ...alertOther,
      })
      expect(isEmpty).toBe(false)
    })
    it('given every element deleted, the generated file is empty', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({ ...header, ...wfBase })
      expect(isEmpty).toBe(true)
    })
    it('given file contains only new element, it keeps the file identical', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({ ...header, ...alert })
      expect(isEmpty).toBe(false)
    })

    it('given one element modified, the generated file contains only this element', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...alertOther,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
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
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...header,
        ...alertOther,
      })
      expect(isEmpty).toBe(false)
    })

    it('given untracked element, nothing trackable changed, the generated file contains untracked elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...unTracked,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({ ...header, ...unTracked })
      expect(isEmpty).toBe(false)
    })
  })
})
