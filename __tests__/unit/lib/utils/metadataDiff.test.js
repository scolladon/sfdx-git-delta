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

const alert = {
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Workflow: {
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
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Workflow: {
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
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Workflow: {
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
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
  Workflow: {
    '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
  },
}

const workFlowAttributs = {
  alerts: { xmlName: 'WorkflowAlert', key: 'fullName' },
}

describe(`MetadataDiff`, () => {
  let metadataDiff
  let globalMetadata
  let work
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    work = {
      config: {
        repo: '',
        to: 'to',
        from: 'from',
      },
      diffs: { package: new Map(), destructiveChanges: new Map() },
      warnings: [],
    }
    metadataDiff = new MetadataDiff(work, globalMetadata, workFlowAttributs)
  })

  describe('compare', () => {
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
    it('given file contains only new element, it keeps the file identical', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(alert)
      parseXmlFileToJson.mockResolvedValueOnce(wfBase)
      await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alert)
    })
    it('given one element added, the generated file contains only this element', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(alert)
      parseXmlFileToJson.mockResolvedValueOnce(alertTest)
      await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alertOther)
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
      metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith(alertOther)
    })

    it('given zero element added and one element delete, the generated file contains empty declaration', async () => {
      // Arrange
      parseXmlFileToJson.mockResolvedValueOnce(alertTest)
      parseXmlFileToJson.mockResolvedValueOnce(alert)
      await metadataDiff.compare('file/path')

      // Act
      metadataDiff.prune()

      // Assert
      expect(convertJsonToXml).toHaveBeenCalledWith({
        ...wfBase,
        Workflow: { alerts: [] },
      })
    })
  })
})
