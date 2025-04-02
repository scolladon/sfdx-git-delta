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

const emptyProfile = {
  Profile: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
  },
}

const profile = {
  Profile: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    layoutAssignments: [
      {
        layout: 'test-layout',
        recordType: 'test-recordType',
      },
    ],
    loginHours: [
      {
        mondayStart: '300',
        mondayEnd: '500',
      },
    ],
    loginIpRanges: [
      {
        description: 'ip range description',
        endAddress: '168.0.0.1',
        startAddress: '168.0.0.255',
      },
    ],
  },
}

const profileChanged = {
  Profile: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    layoutAssignments: [
      {
        layout: 'another-test-layout',
        recordType: 'test-recordType',
      },
    ],
    loginHours: [
      {
        mondayStart: '400',
        mondayEnd: '500',
      },
    ],
    loginIpRanges: [
      {
        description: 'ip range description',
        endAddress: '168.0.0.0',
        startAddress: '168.0.0.255',
      },
    ],
  },
}

const profileAdded = {
  Profile: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
    layoutAssignments: [
      {
        layout: 'test-layout',
        recordType: 'test-recordType',
      },
      {
        layout: 'another-test-layout',
        recordType: 'test-recordType',
      },
    ],
    loginHours: [
      {
        mondayStart: '300',
        mondayEnd: '500',
      },
      {
        tuesdayStart: '400',
        tuesdayEnd: '500',
      },
    ],
    loginIpRanges: [
      {
        description: 'ip range description',
        endAddress: '168.0.0.0',
        startAddress: '168.0.0.255',
      },
      {
        description: 'complete ip range description',
        endAddress: '168.0.0.1',
        startAddress: '168.0.0.255',
      },
    ],
  },
}

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
    unTracked: [
      {
        fullName: 'untracked',
      },
    ],
  },
}

describe.each([[{}], [xmlHeader]])(`MetadataDiff`, header => {
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

    it('do not detect not tracked elements', async () => {
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

    it('detects parsed empty elements', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...{
          Workflow: {
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
            alerts: [],
          },
        },
      })
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

    it('given only elements removed and empty parsed, the generated file is empty', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...{
          Profile: {
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
            layoutAssignments: [],
          },
        },
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...{
          Profile: {
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
            layoutAssignments: [
              {
                layout: 'another-test-layout',
                recordType: 'test-recordType',
              },
            ],
          },
        },
      })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...header,
        ...{
          Profile: {
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          },
        },
      })
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

    describe('key less elements', () => {
      it('given one element modified, the generated file contains the difference', async () => {
        /*
        Cas loginHours et loginIpRanges = si les tableaux sont égaux => on met tableau vide sinon on met le dernier tableau
        Cas layout : ajouter tous les éléments de to qui ne sont pas dans from
        */
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profileChanged,
        })
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profile,
        })
        await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune()

        // Assert
        expect(convertJsonToXml).toHaveBeenCalledWith({
          ...header,
          ...profileChanged,
        })
        expect(isEmpty).toBe(false)
      })

      it('given added elements, the generated file contains the difference', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profileAdded,
        })
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profile,
        })
        await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune()

        // Assert
        expect(convertJsonToXml).toHaveBeenCalledWith({
          ...header,
          ...{
            Profile: {
              '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
              layoutAssignments: [
                {
                  layout: 'another-test-layout',
                  recordType: 'test-recordType',
                },
              ],
              loginHours: [
                {
                  mondayStart: '300',
                  mondayEnd: '500',
                },
                {
                  tuesdayStart: '400',
                  tuesdayEnd: '500',
                },
              ],
              loginIpRanges: [
                {
                  description: 'ip range description',
                  endAddress: '168.0.0.0',
                  startAddress: '168.0.0.255',
                },
                {
                  description: 'complete ip range description',
                  endAddress: '168.0.0.1',
                  startAddress: '168.0.0.255',
                },
              ],
            },
          },
        })
        expect(isEmpty).toBe(false)
      })

      it('given no element added nor modified, the generated file contains empty definition', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profile,
        })
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profile,
        })
        await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune()

        // Assert
        expect(convertJsonToXml).toHaveBeenCalledWith({
          ...header,
          ...emptyProfile,
        })
        expect(isEmpty).toBe(true)
      })

      it('given no element added nor modified, the generated file contains empty profile', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...emptyProfile,
        })
        mockedParseXmlFileToJson.mockResolvedValueOnce({
          ...header,
          ...profile,
        })
        await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune()

        // Assert
        expect(convertJsonToXml).toHaveBeenCalledWith({
          ...header,
          ...emptyProfile,
        })
        expect(isEmpty).toBe(true)
      })
    })

    it('given untracked element added and empty base, nothing trackable changed, the generated file is not empty', async () => {
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

    it('given untracked element added and other base, nothing trackable changed, the generated file is not empty', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...unTracked,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...header,
        ...{
          Workflow: {
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
            unTracked: [
              {
                fullName: 'default',
              },
            ],
          },
        },
      })
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({ ...header, ...unTracked })
      expect(isEmpty).toBe(false)
    })
  })
})
