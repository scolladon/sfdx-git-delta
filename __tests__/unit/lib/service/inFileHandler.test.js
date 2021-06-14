'use strict'
const InFile = require('../../../../src/service/inFileHandler')
const gc = require('../../../../src/utils/gitConstants')
const mc = require('../../../../src/utils/metadataConstants')
const child_process = require('child_process')
const fsMocked = require('fs')
const os = require('os')
const xml2jsMocked = require('fast-xml-parser')

jest.mock('child_process', () => ({ spawnSync: jest.fn() }))
jest.mock('fs')
jest.mock('fs-extra')
jest.mock('fast-xml-parser')

const testContext = {
  handler: InFile,
  testData: [
    [
      'workflows',
      'force-app/main/default/workflows/Account.workflow-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<alerts>${os.EOL}<fullName>TestEA</fullName>${os.EOL}</alerts>${os.EOL}<fieldUpdates>${os.EOL}<fullName>TestFU</fullName>${os.EOL}</fieldUpdates>${os.EOL}<rules>${os.EOL}<fullName>TestRule</fullName>${os.EOL}</rules>${os.EOL}${os.EOL}</Workflow>`,
      '{"Workflow":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"alerts":[{"fullName":["TestEA"]}],"fieldUpdates":[{"fullName":["TestFU"]}],"rules":[{"fullName":["TestRule"]}]}}',
    ],
    [
      'workflows',
      'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<alerts>${os.EOL}<fullName>TestEA</fullName>${os.EOL}</alerts>${os.EOL}<fieldUpdates>${os.EOL}<fullName>TestFU</fullName>${os.EOL}</fieldUpdates>${os.EOL}<rules>${os.EOL}<fullName>TestRule</fullName>${os.EOL}</rules>${os.EOL}${os.EOL}</Workflow>`,
      '{"Workflow":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"alerts":[{"fullName":["TestEA"]}],"fieldUpdates":[{"fullName":["TestFU"]}],"rules":[{"fullName":["TestRule"]}]}}',
    ],
    [
      'labels',
      'force-app/main/default/labels/CustomLabels.labels-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<labels>${os.EOL}<fullName>TestLabel1</fullName>${os.EOL}</labels>${os.EOL}<labels>${os.EOL}<fullName>TestLabel2</fullName>${os.EOL}</labels>${os.EOL}</CustomLabels>`,
      '{"CustomLabels":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"labels":[{"fullName":["TestLabel1"]},{"fullName":["TestLabel2"]}]}}',
    ],
    [
      'sharingRules',
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<sharingCriteriaRules>${os.EOL}<fullName>TestCBS</fullName>${os.EOL}</sharingCriteriaRules>${os.EOL}<sharingOwnerRules>${os.EOL}<fullName>TestOBS</fullName>${os.EOL}</sharingOwnerRules>${os.EOL}</SharingRules>`,
      '{"SharingRules":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"sharingCriteriaRules":[{"fullName":["TestCBS"]}],"sharingOwnerRules":[{"fullName":["TestOBS"]}]}}',
    ],
    [
      'sharingRules',
      'force-app/main/default/sharingRules/Test/Account.sharingRules-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<sharingCriteriaRules>${os.EOL}<fullName>TestCBS</fullName>${os.EOL}</sharingCriteriaRules>${os.EOL}<sharingOwnerRules>${os.EOL}<fullName>TestOBS</fullName>${os.EOL}</sharingOwnerRules>${os.EOL}</SharingRules>`,
      '{"SharingRules":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"sharingCriteriaRules":[{"fullName":["TestCBS"]}],"sharingOwnerRules":[{"fullName":["TestOBS"]}]}}',
    ],
    [
      'bot',
      'force-app/main/default/bot/Test.bot-meta.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<Bot xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<botVersions>${os.EOL}<fullName>v1</fullName>${os.EOL}</botVersions></Bot>`,
      '{"Bot":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"BotVersion":[{"fullName":["v1"]}]}}',
    ],
  ],
  expectedData: {
    workflows: { 'workflows.alerts': new Set(['Account.TestEA']) },
    labels: {},
    sharingRules: {
      'sharingRules.sharingCriteriaRules': new Set(['Account.TestCBS']),
    },
    bot: {
      'bot.botVersions': new Set(['Test.v1']),
    },
  },
}
testContext.expectedData.labels[mc.LABEL_DIRECTORY_NAME] = new Set([
  'TestLabel1',
  'TestLabel2',
])

fsMocked.__setMockFiles({
  [testContext.testData[0][1]]: testContext.testData[0][2],
  [testContext.testData[1][1]]: testContext.testData[1][2],
  [testContext.testData[2][1]]: testContext.testData[2][2],
  [testContext.testData[3][1]]: testContext.testData[3][2],
  [testContext.testData[4][1]]: testContext.testData[4][2],
  [testContext.testData[5][1]]: testContext.testData[5][2],
})

xml2jsMocked.__setMockContent({
  [testContext.testData[0][2]]: testContext.testData[0][3],
  [testContext.testData[1][2]]: testContext.testData[1][3],
  [testContext.testData[2][2]]: testContext.testData[2][3],
  [testContext.testData[3][2]]: testContext.testData[3][3],
  [testContext.testData[4][2]]: testContext.testData[4][3],
  [testContext.testData[5][2]]: testContext.testData[5][3],
})

// eslint-disable-next-line no-undef
describe(`test if inFileHandler`, () => {
  let work
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
      test('addition', () => {
        const handler = new testContext.handler(
          `A       ${changePath}`,
          expectedType,
          work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        child_process.spawnSync.mockImplementation(() => ({
          stdout: xmlContent
            .split(os.EOL)
            .map(x => `${gc.PLUS} ${x}`)
            .join(os.EOL),
        }))
        handler.handle()

        expect(work.diffs.package).toMatchObject(
          testContext.expectedData[expectedType]
        )
        if (expectedType === mc.LABEL_EXTENSION) {
          expect(work.diffs.package).not.toHaveProperty(expectedType)
        } else {
          expect(work.diffs.package).toHaveProperty(expectedType)
        }
      })
      test('deletion', () => {
        const handler = new testContext.handler(
          `D       ${changePath}`,
          expectedType,
          work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        child_process.spawnSync.mockImplementation(() => ({
          stdout: xmlContent
            .split(os.EOL)
            .map(x => `${gc.MINUS} ${x}`)
            .join(os.EOL),
        }))
        handler.handle()
        expect(work.diffs.destructiveChanges).toMatchObject(
          testContext.expectedData[expectedType]
        )
        expect(work.diffs.destructiveChanges).not.toHaveProperty('workflows')
        expect(work.diffs.destructiveChanges).not.toHaveProperty(
          mc.LABEL_EXTENSION
        )
        expect(work.diffs.destructiveChanges).not.toHaveProperty('sharingRules')
      })
      test('modification', () => {
        const handler = new testContext.handler(
          `M       ${changePath}`,
          expectedType,
          work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        child_process.spawnSync.mockImplementation(() => ({
          stdout: xmlContent
            .split(os.EOL)
            .map(
              x => `${Math.floor(Math.random() * 2) ? gc.PLUS : gc.MINUS} ${x}`
            )
            .join(os.EOL),
        }))
        handler.handle()

        expect(work.diffs.package).toBeDefined()
        expect(work.diffs.destructiveChanges).toBeDefined()
        if (expectedType === mc.LABEL_EXTENSION) {
          expect(work.diffs.package).not.toHaveProperty(expectedType)
        } else {
          expect(work.diffs.package).toHaveProperty(expectedType)
        }
      })

      test('modification without delta generation', () => {
        const work = {
          config: { output: '', repo: '', generateDelta: false },
          diffs: { package: {}, destructiveChanges: {} },
        }
        const handler = new testContext.handler(
          `M       ${changePath}`,
          expectedType,
          work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        child_process.spawnSync.mockImplementation(() => ({
          stdout: xmlContent
            .split(os.EOL)
            .map(x => `${gc.PLUS} ${x}`)
            .join(os.EOL),
        }))
        handler.handle()
        expect(work.diffs.package).toMatchObject(
          testContext.expectedData[expectedType]
        )
        if (expectedType === mc.LABEL_EXTENSION) {
          expect(work.diffs.package).not.toHaveProperty(expectedType)
        } else {
          expect(work.diffs.package).toHaveProperty(expectedType)
        }
      })
    }
  )
})
