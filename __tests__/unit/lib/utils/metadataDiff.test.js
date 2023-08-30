'use strict'
const MetadataDiff = require('../../../../src/utils/metadataDiff')
const {
  parseXmlFileToJson,
  convertJsonToXml,
} = require('../../../../src/utils/fxpHelper')

jest.mock('../../../../src/utils/fxpHelper', () => {
  const originalModule = jest.requireActual('../../../../src/utils/fxpHelper')

  return {
    ...originalModule,
    parseXmlFileToJson: jest.fn(),
    convertJsonToXml: jest.fn(),
  }
})
const workFlowAttributes = new Map([
  ['alerts', { xmlName: 'WorkflowAlert', key: 'fullName' }],
])

describe(`MetadataDiff`, () => {
  let metadataDiff
  let globalMetadata
  let work
  let alert, alertOther, alertTest, wfBase, unTracked
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  beforeEach(() => {
    jest.resetAllMocks()
    work = {
      config: {
        repo: '',
        to: 'to',
        from: 'from',
      },
      diffs: { package: new Map(), destructiveChanges: new Map() },
      warnings: [],
    }
    metadataDiff = new MetadataDiff(work, globalMetadata, workFlowAttributes)

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
      parseXmlFileToJson.mockResolvedValueOnce('')
      parseXmlFileToJson.mockResolvedValueOnce('')

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.size).toBe(0)
    })

    it('does not detect not tracked elements', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(unTracked)
      parseXmlFileToJson.mockResolvedValueOnce(wfBase)

      // Act
      const { added, deleted } = await metadataDiff.compare('file/path')

      // Assert
      expect(deleted.size).toBe(0)
      expect(added.size).toBe(0)
    })

    it('detects added elements', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(alert)
      parseXmlFileToJson.mockResolvedValueOnce(wfBase)

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
      parseXmlFileToJson.mockResolvedValueOnce(wfBase)
      parseXmlFileToJson.mockResolvedValueOnce(alert)

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
      parseXmlFileToJson.mockResolvedValueOnce('')
      parseXmlFileToJson.mockResolvedValueOnce(alert)

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
      parseXmlFileToJson.mockResolvedValueOnce(alertTest)
      parseXmlFileToJson.mockResolvedValueOnce({
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
      parseXmlFileToJson.mockResolvedValueOnce(alert)
      parseXmlFileToJson.mockResolvedValueOnce(alertTest)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alertOther)
      expect(isEmpty).toBe(false)
    })
    it('given every element deleted, the generated file is empty', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(alertTest)
      parseXmlFileToJson.mockResolvedValueOnce(alert)
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
      parseXmlFileToJson.mockResolvedValueOnce(alert)
      parseXmlFileToJson.mockResolvedValueOnce(wfBase)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alert)
      expect(isEmpty).toBe(false)
    })

    it('given one element modified, the generated file contains only this element', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(alertOther)
      parseXmlFileToJson.mockResolvedValueOnce({
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
      parseXmlFileToJson.mockResolvedValueOnce(unTracked)
      parseXmlFileToJson.mockResolvedValueOnce(wfBase)
      await metadataDiff.compare('file/path')

      // Act
      const { isEmpty } = metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(unTracked)
      expect(isEmpty).toBe(false)
    })
  })
})
