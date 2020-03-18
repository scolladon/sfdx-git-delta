'use strict'
const InFile = require('../../../../lib/service/inFileHandler')
const mySpawn = require('mock-spawn')()
const fsMocked = require('fs')
const os = require('os')
const xml2jsMocked = require('xml2js')

require('child_process').spawn = mySpawn
jest.mock('fs')
jest.mock('fs-extra')
jest.mock('xml2js')

const testContext = {
  handler: InFile,
  testData: [
    [
      'alerts',
      'force-app/main/default/workflows/Account.workflow-meta.xml',
      new Set(['Account.TestEA']),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<alerts>${os.EOL}<fullName>TestEA</fullName>${os.EOL}</alerts>${os.EOL}<fieldUpdates>${os.EOL}<fullName>TestFU</fullName>${os.EOL}</fieldUpdates>${os.EOL}<rules>${os.EOL}<fullName>TestRule</fullName>${os.EOL}</rules>${os.EOL}</Workflow>`,
      '{"Workflow":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"alerts":[{"fullName":["TestEA"]}],"fieldUpdates":[{"fullName":["TestFU"]}],"rules":[{"fullName":["TestRule"]}]}}',
    ],
    [
      'label',
      'force-app/main/default/labels/CustomLabels.labels-meta.xml',
      new Set(['TestLabel1', 'TestLabel2']),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<labels>${os.EOL}<fullName>TestLabel1</fullName>${os.EOL}</labels>${os.EOL}<labels>${os.EOL}<fullName>TestLabel2</fullName>${os.EOL}</labels>${os.EOL}</CustomLabels>`,
      '{"CustomLabels":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"labels":[{"fullName":["TestLabel1"]},{"fullName":["TestLabel2"]}]}}',
    ],
    [
      'sharingCriteriaRules',
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml',
      new Set(['Account.TestCBS']),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${os.EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${os.EOL}<sharingCriteriaRules>${os.EOL}<fullName>TestCBS</fullName>${os.EOL}</sharingCriteriaRules>${os.EOL}<sharingOwnerRules>${os.EOL}<fullName>TestOBS</fullName>${os.EOL}</sharingOwnerRules>${os.EOL}</SharingRules>`,
      '{"SharingRules":{"$":{"xmlns":"http://soap.sforce.com/2006/04/metadata"},"sharingCriteriaRules":[{"fullName":["TestCBS"]}],"sharingOwnerRules":[{"fullName":["TestOBS"]}]}}',
    ],
  ],
  work: {
    config: { output: '', repo: '' },
    diffs: { package: {}, destructiveChanges: {} },
    promises: [],
  },
}

testContext.testData.forEach(data => {
  const lines = data[3].split(os.EOL)

  mySpawn.sequence.add(mySpawn.simple(0, lines.map(x => `-${x}`).join(os.EOL)))
  let i = 2
  for (; i < 8; ++i) {
    lines[i] = `${i < 5 ? '-' : '+'}${lines[i]}`
  }
  mySpawn.sequence.add(mySpawn.simple(0, lines.join(os.EOL)))
})

fsMocked.__setMockFiles({
  [testContext.testData[0][1]]: testContext.testData[0][3],
  [testContext.testData[1][1]]: testContext.testData[1][3],
  [testContext.testData[2][1]]: testContext.testData[2][3],
})

xml2jsMocked.__setMockContent({
  [testContext.testData[0][3]]: testContext.testData[0][4],
  [testContext.testData[1][3]]: testContext.testData[1][4],
  [testContext.testData[2][3]]: testContext.testData[2][4],
})

// eslint-disable-next-line no-undef
describe(`test if inFileHandler`, () => {
  describe.each(testContext.testData)(
    'handles',
    (expectedType, changePath, expectedValue) => {
      beforeEach(
        () => (testContext.work.diffs = { package: {}, destructiveChanges: {} })
      )
      test('addition', () => {
        const handler = new testContext.handler(
          `A       ${changePath}`,
          expectedType,
          testContext.work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        handler.handle()
      })
      test('deletion', async () => {
        const handler = new testContext.handler(
          `D       ${changePath}`,
          'workflows',
          testContext.work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        handler.handle()
        await Promise.all(testContext.work.promises)
        expect(testContext.work.diffs.destructiveChanges).toHaveProperty(
          expectedType,
          expectedValue
        )
      })
      test('modification', () => {
        const handler = new testContext.handler(
          `M       ${changePath}`,
          expectedType,
          testContext.work,
          // eslint-disable-next-line no-undef
          globalMetadata
        )
        handler.handle()
      })
    }
  )
})
