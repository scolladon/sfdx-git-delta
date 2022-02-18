'use strict'
const InFile = require('../../../../src/service/inFileHandler')
const { PLUS, MINUS } = require('../../../../src/utils/gitConstants')
const {
  LABEL_EXTENSION,
  LABEL_DIRECTORY_NAME,
} = require('../../../../src/utils/metadataConstants')
const metadataManager = require('../../../../src/metadata/metadataManager')
const { EOL } = require('os')

jest.mock('fs')
jest.mock('fs-extra')
jest.mock('fast-xml-parser')

jest.mock('../../../../src/utils/fileGitDiff')
const fileGitDiff = require('../../../../src/utils/fileGitDiff')

const fs = require('fs')
const fxp = require('fast-xml-parser')

const testContext = {
  handler: InFile,
  testData: [
    [
      'workflows',
      'force-app/main/default/workflows/Account.workflow-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<alerts>${EOL}<fullName>TestEA</fullName>${EOL}</alerts>${EOL}<fieldUpdates>${EOL}<fullName>TestFU</fullName>${EOL}</fieldUpdates>${EOL}<rules>${EOL}<fullName>TestRule</fullName>${EOL}</rules>${EOL}${EOL}</Workflow>`,
      '{"Workflow":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"alerts":[{"fullName":["TestEA"]}],"fieldUpdates":[{"fullName":["TestFU"]}],"rules":[{"fullName":["TestRule"]}]}}',
    ],
    [
      'workflows',
      'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<alerts>${EOL}<fullName>TestEA</fullName>${EOL}</alerts>${EOL}<fieldUpdates>${EOL}<fullName>TestFU</fullName>${EOL}</fieldUpdates>${EOL}<rules>${EOL}<fullName>TestRule</fullName>${EOL}</rules>${EOL}${EOL}</Workflow>`,
      '{"Workflow":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"alerts":[{"fullName":["TestEA"]}],"fieldUpdates":[{"fullName":["TestFU"]}],"rules":[{"fullName":["TestRule"]}]}}',
    ],
    [
      'labels',
      'force-app/main/default/labels/CustomLabels.labels-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<labels>${EOL}<fullName>TestLabel1</fullName>${EOL}</labels>${EOL}<labels>${EOL}<fullName>TestLabel2</fullName>${EOL}</labels>${EOL}</CustomLabels>`,
      '{"CustomLabels":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"labels":[{"fullName":["TestLabel1"]},{"fullName":["TestLabel2"]}]}}',
    ],
    [
      'sharingRules',
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<sharingCriteriaRules>${EOL}<fullName>TestCBS</fullName>${EOL}</sharingCriteriaRules>${EOL}<sharingOwnerRules>${EOL}<fullName>TestOBS</fullName>${EOL}</sharingOwnerRules>${EOL}</SharingRules>`,
      '{"SharingRules":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"sharingCriteriaRules":[{"fullName":["TestCBS"]}],"sharingOwnerRules":[{"fullName":["TestOBS"]}]}}',
    ],
    [
      'sharingRules',
      'force-app/main/default/sharingRules/Test/Account.sharingRules-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<sharingCriteriaRules>${EOL}<fullName>TestCBS</fullName>${EOL}</sharingCriteriaRules>${EOL}<sharingOwnerRules>${EOL}<fullName>TestOBS</fullName>${EOL}</sharingOwnerRules>${EOL}</SharingRules>`,
      '{"SharingRules":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"sharingCriteriaRules":[{"fullName":["TestCBS"]}],"sharingOwnerRules":[{"fullName":["TestOBS"]}]}}',
    ],
  ],
  expectedData: {
    workflows: { 'workflows.alerts': new Set(['Account.TestEA']) },
    labels: {},
    sharingRules: {
      'sharingRules.sharingCriteriaRules': new Set(['Account.TestCBS']),
    },
  },
}
testContext.expectedData.labels[LABEL_DIRECTORY_NAME] = new Set([
  'TestLabel1',
  'TestLabel2',
])

fs.__setMockFiles({
  [testContext.testData[0][1]]: testContext.testData[0][2],
  [testContext.testData[1][1]]: testContext.testData[1][2],
  [testContext.testData[2][1]]: testContext.testData[2][2],
  [testContext.testData[3][1]]: testContext.testData[3][2],
  [testContext.testData[4][1]]: testContext.testData[4][2],
})

fxp.__setMockContent({
  [testContext.testData[0][2]]: testContext.testData[0][3],
  [testContext.testData[1][2]]: testContext.testData[1][3],
  [testContext.testData[2][2]]: testContext.testData[2][3],
  [testContext.testData[3][2]]: testContext.testData[3][3],
  [testContext.testData[4][2]]: testContext.testData[4][3],
})

// eslint-disable-next-line no-undef
describe(`test if inFileHandler`, () => {
  let work
  let globalMetadata
  beforeAll(async () => {
    globalMetadata = await metadataManager.getDefinition('directoryName', 50)
  })
  beforeEach(() => {
    work = {
      config: { output: '', repo: '', generateDelta: true },
      diffs: { package: {}, destructiveChanges: {} },
      warnings: [],
    }
  })
  describe.each(testContext.testData)(
    'handles',
    (expectedType, changePath, xmlContent) => {
      test('addition', async () => {
        const handler = new testContext.handler(
          `A       ${changePath}`,
          expectedType,
          work,
          globalMetadata
        )

        fileGitDiff.mockImplementation(() =>
          xmlContent.split(EOL).map(x => `${PLUS} ${x}`)
        )

        await handler.handle()

        expect(work.diffs.package).toMatchObject(
          testContext.expectedData[expectedType]
        )
        if (expectedType === LABEL_EXTENSION) {
          expect(work.diffs.package).not.toHaveProperty(expectedType)
        } else {
          expect(work.diffs.package).toHaveProperty(expectedType)
        }
      })
      test('deletion', async () => {
        const handler = new testContext.handler(
          `D       ${changePath}`,
          expectedType,
          work,
          globalMetadata
        )

        fileGitDiff.mockImplementation(() =>
          xmlContent.split(EOL).map(x => `${MINUS} ${x}`)
        )

        await handler.handle()
        expect(work.diffs.destructiveChanges).toMatchObject(
          testContext.expectedData[expectedType]
        )
        expect(work.diffs.destructiveChanges).not.toHaveProperty('workflows')
        expect(work.diffs.destructiveChanges).not.toHaveProperty(
          LABEL_EXTENSION
        )
        expect(work.diffs.destructiveChanges).not.toHaveProperty('sharingRules')
      })
      test('modification', async () => {
        const handler = new testContext.handler(
          `M       ${changePath}`,
          expectedType,
          work,
          globalMetadata
        )

        fileGitDiff.mockImplementation(() =>
          xmlContent
            .split(EOL)
            .map(x => `${Math.floor(Math.random() * 2) ? PLUS : MINUS} ${x}`)
        )

        await handler.handle()

        expect(work.diffs.package).toBeDefined()
        expect(work.diffs.destructiveChanges).toBeDefined()
        if (expectedType === LABEL_EXTENSION) {
          expect(work.diffs.package).not.toHaveProperty(expectedType)
        } else {
          expect(work.diffs.package).toHaveProperty(expectedType)
        }
      })

      test('modification without delta generation', async () => {
        const work = {
          config: { output: '', repo: '', generateDelta: false },
          diffs: { package: {}, destructiveChanges: {} },
        }
        const handler = new testContext.handler(
          `M       ${changePath}`,
          expectedType,
          work,
          globalMetadata
        )

        fileGitDiff.mockImplementation(() =>
          xmlContent.split(EOL).map(x => `${PLUS} ${x}`)
        )

        await handler.handle()
        expect(work.diffs.package).toMatchObject(
          testContext.expectedData[expectedType]
        )
        if (expectedType === LABEL_EXTENSION) {
          expect(work.diffs.package).not.toHaveProperty(expectedType)
        } else {
          expect(work.diffs.package).toHaveProperty(expectedType)
        }
      })
    }
  )

  describe('with bad xml', () => {
    const [expectedType, changePath, xmlContent, expectedResult] = [
      'labels',
      'force-app/main/error/labels/CustomLabels.labels-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<labels>${EOL}<fullName>TestLabel1</fullName>${EOL}</labels>${EOL}</labels>${EOL}<labels>${EOL}<fullName>TestLabel2</fullName>${EOL}</labels>${EOL}</CustomLabels>`,
      {},
    ]
    test('generate proper warning', async () => {
      const handler = new testContext.handler(
        `A       ${changePath}`,
        expectedType,
        work,
        globalMetadata
      )

      fileGitDiff.mockImplementation(() =>
        xmlContent.split(EOL).map(x => `${PLUS} ${x}`)
      )

      await handler.handle()
      expect(work.diffs.package).toMatchObject(expectedResult)
      expect(work.warnings).toHaveLength(1)
    })
  })
})
