'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import {
  getDefinition,
  getInFileAttributes,
} from '../../../../src/metadata/metadataManager'
import { SharedFileMetadata } from '../../../../src/types/metadata'
import type { Work } from '../../../../src/types/work'
import {
  convertJsonToXml,
  parseXmlFileToJson,
} from '../../../../src/utils/fxpHelper'
import MetadataDiff from '../../../../src/utils/metadataDiff'
import { getWork } from '../../../__utils__/testWork'

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

describe('MetadataDiff', () => {
  let metadataDiff: MetadataDiff
  let globalMetadata: MetadataRepository
  let inFileAttribute: Map<string, SharedFileMetadata>
  let work: Work
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
    inFileAttribute = getInFileAttributes(globalMetadata)
  })
  beforeEach(() => {
    jest.resetAllMocks()
    work = getWork()
    work.config.from = 'from'
    work.config.to = 'to'
    metadataDiff = new MetadataDiff(work.config, inFileAttribute)
  })
  describe.each([[{}], [xmlHeader]])(`with Header %j`, header => {
    describe(`compare with ${JSON.stringify(header)} header`, () => {
      it('does not detect null file content', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({})
        mockedParseXmlFileToJson.mockResolvedValueOnce({})

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
        mockedParseXmlFileToJson.mockResolvedValueOnce({})
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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
          const { toContent, fromContent } =
            await metadataDiff.compare('file/path')

          // Act
          const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
          const { toContent, fromContent } =
            await metadataDiff.compare('file/path')

          // Act
          const { isEmpty } = metadataDiff.prune(toContent, fromContent)

          // Assert
          // With key-based comparison:
          // - layoutAssignments (<object> key): only items not in from
          // - loginHours (<array> key): entire array since different
          // - loginIpRanges (<array> key): entire array since different
          expect(convertJsonToXml).toHaveBeenCalledWith({
            ...header,
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
          const { toContent, fromContent } =
            await metadataDiff.compare('file/path')

          // Act
          const { isEmpty } = metadataDiff.prune(toContent, fromContent)

          // Assert
          // With key-based comparison, identical content produces empty arrays
          // which are not included in the output
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
          const { toContent, fromContent } =
            await metadataDiff.compare('file/path')

          // Act
          const { isEmpty } = metadataDiff.prune(toContent, fromContent)

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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

        // Assert
        expect(convertJsonToXml).toHaveBeenCalledWith({
          ...header,
          ...unTracked,
        })
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
        const { toContent, fromContent } =
          await metadataDiff.compare('file/path')

        // Act
        const { isEmpty } = metadataDiff.prune(toContent, fromContent)

        // Assert
        expect(convertJsonToXml).toHaveBeenCalledWith({
          ...header,
          ...unTracked,
        })
        expect(isEmpty).toBe(false)
      })
    })
  })

  describe('when metadata property has no key field defined', () => {
    it('given identical content, isEmpty remains true', async () => {
      // Arrange
      const customAttributes = new Map<string, SharedFileMetadata>([
        [
          'customProperty',
          {
            xmlName: 'CustomProperty',
            xmlTag: 'customProperty',
            // no key field defined
          } as SharedFileMetadata,
        ],
      ])
      const customMetadataDiff = new MetadataDiff(work.config, customAttributes)
      const content = {
        ...xmlHeader,
        CustomType: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          customProperty: [{ value: 'test' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(content)
      mockedParseXmlFileToJson.mockResolvedValueOnce(content)
      const { toContent, fromContent } =
        await customMetadataDiff.compare('file/path')

      // Act
      const { isEmpty } = customMetadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
    })

    it('given different content, isEmpty becomes false', async () => {
      // Arrange
      const customAttributes = new Map<string, SharedFileMetadata>([
        [
          'customProperty',
          {
            xmlName: 'CustomProperty',
            xmlTag: 'customProperty',
            // no key field defined
          } as SharedFileMetadata,
        ],
      ])
      const customMetadataDiff = new MetadataDiff(work.config, customAttributes)
      const fromContentData = {
        ...xmlHeader,
        CustomType: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          customProperty: [{ value: 'original' }],
        },
      }
      const toContentData = {
        ...xmlHeader,
        CustomType: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          customProperty: [{ value: 'modified' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toContentData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromContentData)
      const { toContent, fromContent } =
        await customMetadataDiff.compare('file/path')

      // Act
      const { isEmpty } = customMetadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
    })
  })

  // Unskip me when checking for performance
  describe.skip('Performance tests', () => {
    const formatMemory = (bytes: number): string => {
      if (bytes < 0) return '-' + formatMemory(-bytes)
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
    }

    const makeWorkflow = (alerts: any[]) => {
      return {
        ...xmlHeader,
        Workflow: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          alerts,
        },
      }
    }

    const makeAlertWorkflow = (recordCount: number) => {
      const alerts: any[] = []
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

    it('handles large workflows efficiently', async () => {
      // Arrange
      const baseWorkflow = makeAlertWorkflow(5000)
      const modifiedWorkflow = JSON.parse(JSON.stringify(baseWorkflow))
      const extraAlert = {
        fullName: 'OtherTestEmailAlert',
        description: 'awesome',
        protected: 'false',
        recipients: { field: 'OtherEmail', type: 'email' },
        senderAddress: 'awesome@awesome.com',
        senderType: 'OrgWideEmailAddress',
        template: 'None',
      }
      modifiedWorkflow.Workflow.alerts.push(extraAlert)
      mockedParseXmlFileToJson.mockResolvedValueOnce(modifiedWorkflow)
      mockedParseXmlFileToJson.mockResolvedValueOnce(baseWorkflow)

      if (global.gc) {
        global.gc()
      }

      // Get initial memory usage
      const initialMemory = process.memoryUsage()

      // Track max memory usage during execution
      let maxHeapUsed = initialMemory.heapUsed

      // Setup memory sampling
      const memoryCheckInterval = 5 // ms
      const sampleMemoryUsage = () => {
        const currentMemory = process.memoryUsage()
        maxHeapUsed = Math.max(maxHeapUsed, currentMemory.heapUsed)
      }

      // Start sampling
      const samplingInterval = setInterval(
        sampleMemoryUsage,
        memoryCheckInterval
      )

      // Act
      const startTime = process.hrtime.bigint()
      const { toContent, fromContent } = await metadataDiff.compare('file/path')
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)
      const endTime = process.hrtime.bigint()

      // Stop sampling
      clearInterval(samplingInterval)
      // Final check to capture any last peak
      sampleMemoryUsage()

      // Calculate duration
      const duration = Number(endTime - startTime) / 1_000_000

      // Log performance metrics
      console.log(`Duration: ${duration.toFixed(2)}ms`)
      console.log(
        `Max Heap Used: ${formatMemory(maxHeapUsed - initialMemory.heapUsed)}`
      )

      // Assert
      expect(isEmpty).toBe(false)

      // Verify that the output contains only the extra alert
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Workflow: expect.objectContaining({
            alerts: expect.arrayContaining([extraAlert]),
          }),
        })
      )
    }, 20000)
  })
})
