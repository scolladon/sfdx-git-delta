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
      'workflows',
      'force-app/main/default/workflows/Account.workflow-meta.xml',
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
  ],
  expectedData: {
    workflows: { alerts: new Set(['Account.TestEA']) },
    labels: { label: new Set(['TestLabel1', 'TestLabel2']) },
    sharingRules: { sharingCriteriaRules: new Set(['Account.TestCBS']) },
  },
}

testContext.testData.forEach(data => {
  const lines = data[2].split(os.EOL)

  mySpawn.sequence.add(mySpawn.simple(0, lines.map(x => `-${x}`).join(os.EOL)))
  let i = 2
  for (; i < 8; ++i) {
    lines[i] = `${i < 5 ? '-' : '+'}${lines[i]}`
  }
  mySpawn.sequence.add(mySpawn.simple(0, lines.join(os.EOL)))
  mySpawn.sequence.add(mySpawn.simple(0, lines.join(os.EOL)))
})

fsMocked.__setMockFiles({
  [testContext.testData[0][1]]: testContext.testData[0][2],
  [testContext.testData[1][1]]: testContext.testData[1][2],
  [testContext.testData[2][1]]: testContext.testData[2][2],
})

xml2jsMocked.__setMockContent({
  [testContext.testData[0][2]]: testContext.testData[0][3],
  [testContext.testData[1][2]]: testContext.testData[1][3],
  [testContext.testData[2][2]]: testContext.testData[2][3],
})

// eslint-disable-next-line no-undef
describe(`test if inFileHandler`, () => {
  describe.each(testContext.testData)('handles', (expectedType, changePath) => {
    test('addition', () => {
      const handler = new testContext.handler(
        `A       ${changePath}`,
        expectedType,
        {
          config: { output: '', repo: '', generateDelta: true },
          diffs: { package: {}, destructiveChanges: {} },
          promises: [],
        },
        // eslint-disable-next-line no-undef
        globalMetadata
      )
      handler.handle()
    })
    test('deletion', async () => {
      const work = {
        config: { output: '', repo: '', generateDelta: true },
        diffs: { package: {}, destructiveChanges: {} },
        promises: [],
      }
      const handler = new testContext.handler(
        `D       ${changePath}`,
        expectedType,
        work,
        // eslint-disable-next-line no-undef
        globalMetadata
      )
      handler.handle()
      await Promise.all(work.promises)
      expect(work.diffs.destructiveChanges).toMatchObject(
        testContext.expectedData[expectedType]
      )
    })
    test('modification', () => {
      const handler = new testContext.handler(
        `M       ${changePath}`,
        expectedType,
        {
          config: { output: '', repo: '', generateDelta: true },
          diffs: { package: {}, destructiveChanges: {} },
          promises: [],
        },
        // eslint-disable-next-line no-undef
        globalMetadata
      )
      handler.handle()
    })

    test('modification without delta generation', () => {
      const handler = new testContext.handler(
        `M       ${changePath}`,
        expectedType,
        {
          config: { output: '', repo: '', generateDelta: false },
          diffs: { package: {}, destructiveChanges: {} },
          promises: [],
        },
        // eslint-disable-next-line no-undef
        globalMetadata
      )
      handler.handle()
    })
  })
})
