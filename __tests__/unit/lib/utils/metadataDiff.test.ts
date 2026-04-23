'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import {
  getDefinition,
  getInFileAttributes,
} from '../../../../src/metadata/metadataManager'
import { SharedFileMetadata } from '../../../../src/types/metadata'
import type { Work } from '../../../../src/types/work'
import MetadataDiff from '../../../../src/utils/metadataDiff'
import {
  convertJsonToXml,
  parseXmlFileToJson,
} from '../../../../src/utils/xmlHelper'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/xmlHelper', async () => {
  const actualModule: any = await vi.importActual(
    '../../../../src/utils/xmlHelper'
  )
  return {
    ...actualModule,
    parseXmlFileToJson: vi.fn(),
    convertJsonToXml: vi.fn(),
  }
})
const mockedParseXmlFileToJson = vi.mocked(parseXmlFileToJson)

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
    vi.resetAllMocks()
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
        expect(deleted).toHaveLength(0)
        expect(added).toHaveLength(0)
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
        expect(deleted).toHaveLength(0)
        expect(added).toHaveLength(0)
      })

      it('detects added elements', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })
        mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })

        // Act
        const { added, deleted } = await metadataDiff.compare('file/path')

        // Assert
        expect(deleted).toHaveLength(0)
        expect(added).toEqual(
          expect.arrayContaining([
            { type: 'WorkflowAlert', member: 'OtherTestEmailAlert' },
            { type: 'WorkflowAlert', member: 'TestEmailAlert' },
          ])
        )
        expect(added).toHaveLength(2)
      })
      it('detects removed elements', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...wfBase })
        mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })

        // Act
        const { added, deleted } = await metadataDiff.compare('file/path')

        // Assert
        expect(added).toHaveLength(0)
        expect(deleted).toEqual(
          expect.arrayContaining([
            { type: 'WorkflowAlert', member: 'OtherTestEmailAlert' },
            { type: 'WorkflowAlert', member: 'TestEmailAlert' },
          ])
        )
        expect(deleted).toHaveLength(2)
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
        expect(added).toHaveLength(0)
        expect(deleted).toEqual(
          expect.arrayContaining([
            { type: 'WorkflowAlert', member: 'OtherTestEmailAlert' },
            { type: 'WorkflowAlert', member: 'TestEmailAlert' },
          ])
        )
        expect(deleted).toHaveLength(2)
      })

      it('detects deleted file', async () => {
        // Arrange
        mockedParseXmlFileToJson.mockResolvedValueOnce({})
        mockedParseXmlFileToJson.mockResolvedValueOnce({ ...header, ...alert })

        // Act
        const { added, deleted } = await metadataDiff.compare('file/path')

        // Assert
        expect(added).toHaveLength(0)
        expect(deleted).toEqual(
          expect.arrayContaining([
            { type: 'WorkflowAlert', member: 'OtherTestEmailAlert' },
            { type: 'WorkflowAlert', member: 'TestEmailAlert' },
          ])
        )
        expect(deleted).toHaveLength(2)
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
        const { added, modified, deleted } =
          await metadataDiff.compare('file/path')

        // Assert
        expect(added).toHaveLength(0)
        expect(deleted).toHaveLength(0)
        expect(modified).toEqual([
          { type: 'WorkflowAlert', member: 'TestEmailAlert' },
        ])
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

  describe('compare passes correct arguments to parseXmlFileToJson', () => {
    it('Given a path, When compare is called, Then parseXmlFileToJson receives path and oid for to', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValue({})

      // Act
      await metadataDiff.compare('some/file/path')

      // Assert
      expect(mockedParseXmlFileToJson).toHaveBeenCalledWith(
        { path: 'some/file/path', oid: 'to' },
        expect.anything()
      )
    })

    it('Given a path, When compare is called, Then parseXmlFileToJson receives path and oid for from', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValue({})

      // Act
      await metadataDiff.compare('some/file/path')

      // Assert
      expect(mockedParseXmlFileToJson).toHaveBeenCalledWith(
        { path: 'some/file/path', oid: 'from' },
        expect.anything()
      )
    })
  })

  describe('ATTRIBUTE_PREFIX handling in prune', () => {
    it('Given content with @_ attributes, When pruning, Then attributes are preserved in output', async () => {
      // Arrange
      const toData = {
        ...xmlHeader,
        Workflow: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          '@_customAttr': 'customValue',
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          '@_customAttr': 'customValue',
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Workflow: expect.objectContaining({
            '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
            '@_customAttr': 'customValue',
          }),
        })
      )
    })
  })

  describe('excluded metadata types', () => {
    it('Given an excluded subType, When comparing, Then it is not included in results', async () => {
      // Arrange
      const excludedAttributes = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
            excluded: true,
          } as SharedFileMetadata,
        ],
      ])
      const excludedDiff = new MetadataDiff(work.config, excludedAttributes)
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...xmlHeader, ...alert })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...wfBase,
      })

      // Act
      const { added, deleted } = await excludedDiff.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(deleted).toHaveLength(0)
    })
  })

  describe('elements without key selector returning undefined', () => {
    it('Given elements whose key selector returns undefined, When comparing, Then they are skipped from both added and modified (no identity prevents undefined members)', async () => {
      // Arrange
      const noKeyAttributes = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'nonExistentField',
          } as SharedFileMetadata,
        ],
      ])
      const noKeyDiff = new MetadataDiff(work.config, noKeyAttributes)
      const toData = {
        ...xmlHeader,
        Root: {
          items: [{ value: 'a' }, { value: 'b' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          items: [{ value: 'a' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added, modified } = await noKeyDiff.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(modified).toHaveLength(0)
    })

    it('Given elements whose key selector returns undefined, When comparing deleted, Then they are treated as deleted', async () => {
      // Arrange
      const noKeyAttributes = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'nonExistentField',
          } as SharedFileMetadata,
        ],
      ])
      const noKeyDiff = new MetadataDiff(work.config, noKeyAttributes)
      const toData = {
        ...xmlHeader,
        Root: {
          items: [{ value: 'a' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          items: [{ value: 'a' }, { value: 'b' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { deleted } = await noKeyDiff.compare('file/path')

      // Assert
      expect(deleted).toHaveLength(2)
    })
  })

  describe('matchAdded with defined key', () => {
    it('Given an element with a known key not in from, When comparing, Then it is added', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'NewAlert', description: 'new' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'OldAlert', description: 'old' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added } = await sut.compare('file/path')

      // Assert
      expect(added).toEqual([{ type: 'WorkflowAlert', member: 'NewAlert' }])
    })

    it('Given an element identical in both, When comparing, Then it is not added', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const data = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'SameAlert', description: 'same' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)

      // Act
      const { added } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
    })

    it('Given an element with same key but different content, When comparing, Then it is modified (not added)', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'Alert1', description: 'modified' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'Alert1', description: 'original' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added, modified } = await sut.compare('file/path')

      // Assert
      expect(added).toEqual([])
      expect(modified).toEqual([{ type: 'WorkflowAlert', member: 'Alert1' }])
    })
  })

  describe('matchDeleted with defined key', () => {
    it('Given an element in from but not in to, When comparing, Then it is deleted', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'RemainingAlert', description: 'kept' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'RemainingAlert', description: 'kept' },
            { fullName: 'RemovedAlert', description: 'gone' },
          ],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { deleted } = await sut.compare('file/path')

      // Assert
      expect(deleted).toEqual([
        { type: 'WorkflowAlert', member: 'RemovedAlert' },
      ])
    })

    it('Given an element in both from and to, When comparing, Then it is not deleted', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const data = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'SameAlert', description: 'same' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)

      // Act
      const { deleted } = await sut.compare('file/path')

      // Assert
      expect(deleted).toHaveLength(0)
    })
  })

  describe('extractForSubType with single object instead of array', () => {
    it('Given subType value is a single object, When extracting, Then it wraps in array', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...alertTest,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...wfBase,
      })

      // Act
      const { added } = await metadataDiff.compare('file/path')

      // Assert
      expect(added).toEqual([
        { type: 'WorkflowAlert', member: 'TestEmailAlert' },
      ])
    })
  })

  describe('extractRootKey with only header key', () => {
    it('Given content with only XML header, When pruning, Then produces valid output', async () => {
      // Arrange
      const headerOnly = { ...xmlHeader }
      mockedParseXmlFileToJson.mockResolvedValueOnce(headerOnly)
      mockedParseXmlFileToJson.mockResolvedValueOnce(headerOnly)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
    })
  })

  describe('prune without XML header', () => {
    it('Given content without XML header, When pruning, Then output does not include header', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...alert })
      mockedParseXmlFileToJson.mockResolvedValueOnce({ ...alert })
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.not.objectContaining({
          '?xml': expect.anything(),
        })
      )
    })

    it('Given content with XML header, When pruning, Then output includes header', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...alert,
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...alert,
      })
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          '?xml': xmlHeader['?xml'],
        })
      )
    })
  })

  describe('getPartialContent edge cases', () => {
    it('Given toMeta is empty in prune, When pruning, Then that subType is not in output', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Root: {
          items: [],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          items: [{ fullName: 'something' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Root: {},
      })
    })

    it('Given fromMeta is empty in prune, When pruning, Then toMeta is fully included', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Root: {
          items: [{ fullName: 'newItem' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {},
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Root: {
          items: [{ fullName: 'newItem' }],
        },
      })
    })
  })

  describe('OBJECT_SPECIAL_KEY partial content', () => {
    it('Given object-keyed elements with new items, When pruning, Then only new items are included', async () => {
      // Arrange - layoutAssignments uses <object> special key
      const toData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [
            { layout: 'existing-layout', recordType: 'rt1' },
            { layout: 'new-layout', recordType: 'rt2' },
          ],
        },
      }
      const fromData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [{ layout: 'existing-layout', recordType: 'rt1' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Profile: expect.objectContaining({
            layoutAssignments: [{ layout: 'new-layout', recordType: 'rt2' }],
          }),
        })
      )
    })

    it('Given identical object-keyed elements, When pruning, Then no items are included', async () => {
      // Arrange - layoutAssignments uses <object> special key
      const data = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [{ layout: 'existing-layout', recordType: 'rt1' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
    })
  })

  describe('ARRAY_SPECIAL_KEY partial content', () => {
    it('Given identical array-keyed elements, When pruning, Then content is empty', async () => {
      // Arrange - loginHours uses <array> special key
      const data = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          loginHours: [{ mondayStart: '300', mondayEnd: '500' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        },
      })
    })

    it('Given different array-keyed elements, When pruning, Then entire to array is included', async () => {
      // Arrange - loginHours uses <array> special key
      const toData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          loginHours: [{ mondayStart: '400', mondayEnd: '600' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          loginHours: [{ mondayStart: '300', mondayEnd: '500' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Profile: expect.objectContaining({
            loginHours: [{ mondayStart: '400', mondayEnd: '600' }],
          }),
        })
      )
    })
  })

  describe('getPartialContentWithKey', () => {
    it('Given item in to with key not in from, When pruning, Then item is included', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'NewAlert', description: 'new' },
            { fullName: 'ExistingAlert', description: 'same' },
          ],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'ExistingAlert', description: 'same' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'NewAlert', description: 'new' }],
        },
      })
    })

    it('Given item in to with same key but different content, When pruning, Then item is included', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'Alert1', description: 'changed' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'Alert1', description: 'original' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'Alert1', description: 'changed' }],
        },
      })
    })

    it('Given all items in to identical to from, When pruning, Then no items are included', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const data = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'Alert1', description: 'same' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Workflow: {},
      })
    })
  })

  describe('compare with empty baseMeta', () => {
    it('Given to has empty array for subType, When comparing, Then no added entries', async () => {
      // Arrange
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        Workflow: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          alerts: [],
        },
      })
      mockedParseXmlFileToJson.mockResolvedValueOnce({
        ...xmlHeader,
        ...alert,
      })

      // Act
      const { added } = await metadataDiff.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
    })
  })

  describe('MetadataExtractor optional chaining on missing subType', () => {
    it('Given a subType not in attributes map, When comparing with excluded check, Then no error is thrown and type is skipped', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'knownType',
          {
            xmlName: 'KnownType',
            xmlTag: 'knownType',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Root: {
          knownType: [{ fullName: 'item1' }],
          unknownType: [{ fullName: 'item2' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {},
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added } = await sut.compare('file/path')

      // Assert
      expect(added).toEqual([{ type: 'KnownType', member: 'item1' }])
    })
  })

  describe('excluded type prevents compare entries', () => {
    it('Given an excluded subType in both to and from, When comparing, Then no added or deleted entries', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
            excluded: true,
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'NewAlert', description: 'new' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [{ fullName: 'OldAlert', description: 'old' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added, deleted } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(deleted).toHaveLength(0)
    })

    it('Given an excluded subType with elements only in to, When comparing, Then added is empty', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
            excluded: true,
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'Alert1', description: 'a' },
            { fullName: 'Alert2', description: 'b' },
          ],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {},
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
    })
  })

  describe('OBJECT_SPECIAL_KEY string identity', () => {
    it('Given object-keyed elements where one item differs, When pruning, Then only the differing item is included', async () => {
      // Arrange - layoutAssignments uses <object> special key
      const existingItem = { layout: 'shared-layout', recordType: 'rt1' }
      const newItem = { layout: 'new-layout', recordType: 'rt2' }
      const toData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [existingItem, newItem],
        },
      }
      const fromData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [existingItem],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Profile: expect.objectContaining({
            layoutAssignments: [newItem],
          }),
        })
      )
    })

    it('Given a single object-keyed element identical in both, When pruning, Then element is not included', async () => {
      // Arrange - single element identical in both from and to
      const singleItem = { layout: 'only-layout', recordType: 'rt1' }
      const toData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [singleItem],
        },
      }
      const fromData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [singleItem],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
    })
  })

  describe('compare with identical elements detects no false additions', () => {
    it('Given identical keyed elements in to and from, When comparing, Then no additions detected', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const sharedAlert = { fullName: 'SharedAlert', description: 'same' }
      const data = {
        ...xmlHeader,
        Workflow: {
          alerts: [sharedAlert],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)

      // Act
      const { added, deleted } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(deleted).toHaveLength(0)
    })

    it('Given multiple identical keyed elements, When comparing, Then neither additions nor deletions detected', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const data = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'Alert1', description: 'first' },
            { fullName: 'Alert2', description: 'second' },
            { fullName: 'Alert3', description: 'third' },
          ],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)

      // Act
      const { added, deleted } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(deleted).toHaveLength(0)
    })
  })

  describe('compare detects all deletions when all elements removed', () => {
    it('Given all elements in from but none in to, When comparing, Then all are deleted', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'Alert1', description: 'first' },
            { fullName: 'Alert2', description: 'second' },
          ],
        },
      }
      const toData = {
        ...xmlHeader,
        Workflow: {},
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added, deleted } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(deleted).toEqual(
        expect.arrayContaining([
          { type: 'WorkflowAlert', member: 'Alert1' },
          { type: 'WorkflowAlert', member: 'Alert2' },
        ])
      )
      expect(deleted).toHaveLength(2)
    })

    it('Given all elements removed from a type with multiple entries, When comparing, Then deleted contains each entry', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'RemovedAlert1', description: 'gone1' },
            { fullName: 'RemovedAlert2', description: 'gone2' },
            { fullName: 'RemovedAlert3', description: 'gone3' },
          ],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { deleted } = await sut.compare('file/path')

      // Assert
      expect(deleted).toHaveLength(3)
      expect(deleted).toEqual(
        expect.arrayContaining([
          { type: 'WorkflowAlert', member: 'RemovedAlert1' },
          { type: 'WorkflowAlert', member: 'RemovedAlert2' },
          { type: 'WorkflowAlert', member: 'RemovedAlert3' },
        ])
      )
    })
  })

  describe('key selection strategy in getPartialContent', () => {
    it('Given elements with a defined key field, When pruning with new and modified items, Then only changed items included', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'Unchanged', description: 'same' },
            { fullName: 'Modified', description: 'new-desc' },
            { fullName: 'Added', description: 'brand-new' },
          ],
        },
      }
      const fromData = {
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'Unchanged', description: 'same' },
            { fullName: 'Modified', description: 'old-desc' },
          ],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Workflow: {
          alerts: [
            { fullName: 'Modified', description: 'new-desc' },
            { fullName: 'Added', description: 'brand-new' },
          ],
        },
      })
    })

    it('Given elements with ARRAY_SPECIAL_KEY and different content, When pruning, Then entire to array replaces from', async () => {
      // Arrange - loginHours uses <array> special key
      const toData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          loginHours: [
            { mondayStart: '400', mondayEnd: '600' },
            { tuesdayStart: '300', tuesdayEnd: '500' },
          ],
        },
      }
      const fromData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          loginHours: [{ mondayStart: '300', mondayEnd: '500' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Profile: expect.objectContaining({
            loginHours: [
              { mondayStart: '400', mondayEnd: '600' },
              { tuesdayStart: '300', tuesdayEnd: '500' },
            ],
          }),
        })
      )
    })

    it('Given elements with OBJECT_SPECIAL_KEY where multiple items differ, When pruning, Then only new items included', async () => {
      // Arrange - layoutAssignments uses <object> special key
      const shared = { layout: 'shared-layout', recordType: 'rt1' }
      const newItem1 = { layout: 'new-layout-1', recordType: 'rt2' }
      const newItem2 = { layout: 'new-layout-2', recordType: 'rt3' }
      const toData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [shared, newItem1, newItem2],
        },
      }
      const fromData = {
        ...xmlHeader,
        Profile: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          layoutAssignments: [shared],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith(
        expect.objectContaining({
          Profile: expect.objectContaining({
            layoutAssignments: [newItem1, newItem2],
          }),
        })
      )
    })

    it('Given elements with no key field and identical content, When pruning, Then content is included but isEmpty is true', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'customProp',
          {
            xmlName: 'CustomProp',
            xmlTag: 'customProp',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const data = {
        ...xmlHeader,
        Root: {
          customProp: [{ value: 'same' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(true)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Root: {
          customProp: [{ value: 'same' }],
        },
      })
    })

    it('Given elements with no key field and different content, When pruning, Then to content replaces from', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'customProp',
          {
            xmlName: 'CustomProp',
            xmlTag: 'customProp',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Root: {
          customProp: [{ value: 'new' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          customProp: [{ value: 'old' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Root: {
          customProp: [{ value: 'new' }],
        },
      })
    })

    it('Given all four key strategies in one document, When pruning, Then each strategy is applied correctly', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'alerts',
          {
            xmlName: 'WorkflowAlert',
            xmlTag: 'alerts',
            key: 'fullName',
          } as SharedFileMetadata,
        ],
        [
          'loginHours',
          {
            xmlName: 'ProfileLoginHours',
            xmlTag: 'loginHours',
            key: '<array>',
          } as SharedFileMetadata,
        ],
        [
          'layoutAssignments',
          {
            xmlName: 'ProfileLayoutAssignment',
            xmlTag: 'layoutAssignments',
            key: '<object>',
          } as SharedFileMetadata,
        ],
        [
          'noKeyProp',
          {
            xmlName: 'NoKeyProp',
            xmlTag: 'noKeyProp',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const sharedLayout = { layout: 'shared', recordType: 'rt1' }
      const newLayout = { layout: 'new', recordType: 'rt2' }
      const toData = {
        ...xmlHeader,
        Root: {
          alerts: [
            { fullName: 'Same', description: 'same' },
            { fullName: 'New', description: 'new' },
          ],
          loginHours: [{ mondayStart: '400', mondayEnd: '600' }],
          layoutAssignments: [sharedLayout, newLayout],
          noKeyProp: [{ value: 'changed' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          alerts: [{ fullName: 'Same', description: 'same' }],
          loginHours: [{ mondayStart: '300', mondayEnd: '500' }],
          layoutAssignments: [sharedLayout],
          noKeyProp: [{ value: 'original' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await sut.compare('file/path')

      // Act
      const { isEmpty } = sut.prune(toContent, fromContent)

      // Assert
      expect(isEmpty).toBe(false)
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...xmlHeader,
        Root: {
          alerts: [{ fullName: 'New', description: 'new' }],
          loginHours: [{ mondayStart: '400', mondayEnd: '600' }],
          layoutAssignments: [newLayout],
          noKeyProp: [{ value: 'changed' }],
        },
      })
    })
  })

  describe('matchAdded and matchDeleted with undefined key selector', () => {
    it('Given elements where key selector returns undefined, When comparing, Then they are skipped from added and modified (keyless has no identity)', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'missingField',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Root: {
          items: [{ name: 'a' }, { name: 'b' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          items: [{ name: 'a' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { added, modified } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(modified).toHaveLength(0)
    })

    it('Given elements where key selector returns undefined, When comparing deletions, Then all from elements are treated as deleted', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'missingField',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const toData = {
        ...xmlHeader,
        Root: {
          items: [{ name: 'x' }],
        },
      }
      const fromData = {
        ...xmlHeader,
        Root: {
          items: [{ name: 'x' }, { name: 'y' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)

      // Act
      const { deleted } = await sut.compare('file/path')

      // Assert
      expect(deleted).toHaveLength(2)
      expect(deleted).toEqual([
        { type: 'CustomItem', member: undefined },
        { type: 'CustomItem', member: undefined },
      ])
    })

    it('Given elements where key selector returns undefined for both sides, When comparing, Then added/modified skip them while deleted retains pre-existing behaviour', async () => {
      // Arrange
      const attrs = new Map<string, SharedFileMetadata>([
        [
          'items',
          {
            xmlName: 'CustomItem',
            xmlTag: 'items',
            key: 'missingField',
          } as SharedFileMetadata,
        ],
      ])
      const sut = new MetadataDiff(work.config, attrs)
      const data = {
        ...xmlHeader,
        Root: {
          items: [{ name: 'same' }],
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)
      mockedParseXmlFileToJson.mockResolvedValueOnce(data)

      // Act
      const { added, modified, deleted } = await sut.compare('file/path')

      // Assert
      expect(added).toHaveLength(0)
      expect(modified).toHaveLength(0)
      expect(deleted).toHaveLength(1)
    })
  })

  describe('prune without XML header attribute key', () => {
    it('Given toContent lacks XML header, When pruning, Then output does not have XML header key set to undefined', async () => {
      // Arrange
      const toData = {
        Workflow: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
          alerts: [{ fullName: 'NewAlert', description: 'new' }],
        },
      }
      const fromData = {
        Workflow: {
          '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
        },
      }
      mockedParseXmlFileToJson.mockResolvedValueOnce(toData)
      mockedParseXmlFileToJson.mockResolvedValueOnce(fromData)
      const { toContent, fromContent } = await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune(toContent, fromContent)

      // Assert
      const calledWith = vi.mocked(convertJsonToXml).mock.calls[0][0]
      expect(calledWith).not.toHaveProperty('?xml')
    })
  })
})
