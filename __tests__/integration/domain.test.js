'use strict'
const HandlerFactory = require('../../src/service/typeHandlerFactory')
const {
  ADDITION,
  DELETION,
  MODIFICATION,
} = require('../../src/utils/gitConstants')
const { readPathFromGit } = require('../../src/utils/fsHelper')

jest.mock('../../src/utils/fsHelper')

const testContext = [
  [
    'force-app/main/default/bots/TestBot/TestBot.bot-meta.xml',
    new Set(['TestBot']),
    'Bot',
  ],
  [
    'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml',
    new Set(['TestBot.v1']),
    'BotVersion',
  ],
  [
    'force-app/main/default/objects/Account/Account.object-meta.xml',
    new Set(['Account']),
    'CustomObject',
  ],
  [
    'force-app/main/default/objects/Test/Account/Account.object-meta.xml',
    new Set(['Account']),
    'CustomObject',
  ],
  [
    'force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
    new Set(['EU']),
    'Territory2Model',
  ],
  [
    'force-app/main/default/workflows/Account.workflow-meta.xml',
    new Set(['Account.Test']),
    'WorkflowAlert',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><alerts><fullName>Test</fullName></alerts></Workflow>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"></Workflow>`,
  ],
  [
    'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
    new Set(['Account.Test']),
    'WorkflowFieldUpdate',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><fieldUpdates><fullName>Test</fullName></fieldUpdates></Workflow>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"></Workflow>`,
  ],
  [
    'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
    new Set(['Account.Test']),
    'WorkflowOutboundMessage',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><outboundMessages><fullName>Test</fullName></outboundMessages></Workflow>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"></Workflow>`,
  ],
  [
    'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
    new Set(['Account.Test']),
    'WorkflowRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><rules><fullName>Test</fullName></rules></Workflow>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"></Workflow>`,
  ],
  [
    'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
    new Set(['Account.Test']),
    'WorkflowFlowAction',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><flowActions><fullName>Test</fullName></flowActions></Workflow>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"></Workflow>`,
  ],
  [
    'force-app/main/default/sharingRules/Account.sharingRules-meta.xml',
    new Set(['Account.Criteria']),
    'SharingCriteriaRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"><sharingCriteriaRules><fullName>Criteria</fullName></sharingCriteriaRules></SharingRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"></SharingRules>`,
  ],
  [
    'force-app/main/default/sharingRules/Test/Account.sharingRules-meta.xml',
    new Set(['Account.Criteria']),
    'SharingCriteriaRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"><sharingCriteriaRules><fullName>Criteria</fullName></sharingCriteriaRules></SharingRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"></SharingRules>`,
  ],
  [
    'force-app/main/default/labels/CustomLabels.labels-meta.xml',
    new Set(['Label']),
    'CustomLabel',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"><labels><fullName>Label</fullName></labels></CustomLabels>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"></CustomLabels>`,
  ],
  [
    'force-app/main/default/assignmentRules/Account.assignmentRule-meta.xml',
    new Set(['Account.AccountRule']),
    'AssignmentRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata"><assignmentRule><fullName>AccountRule</fullName></assignmentRule></AssignmentRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata"></AssignmentRules>`,
  ],
  [
    'force-app/main/default/autoResponseRules/Account.autoResponseRule-meta.xml',
    new Set(['Account.AccountRule']),
    'AutoResponseRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AutoResponseRules xmlns="http://soap.sforce.com/2006/04/metadata"><autoResponseRule><fullName>AccountRule</fullName></autoResponseRule></AutoResponseRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AutoResponseRules xmlns="http://soap.sforce.com/2006/04/metadata"></AutoResponseRules>`,
  ],
  [
    'force-app/main/default/escalationRules/Account.escalationRule-meta.xml',
    new Set(['Account.AccountRule']),
    'EscalationRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><EscalationRules xmlns="http://soap.sforce.com/2006/04/metadata"><escalationRule><fullName>AccountRule</fullName></escalationRule></EscalationRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><EscalationRules xmlns="http://soap.sforce.com/2006/04/metadata"></EscalationRules>`,
  ],
  [
    'force-app/main/default/matchingRules/Account.matchingRule-meta.xml',
    new Set(['Account.AccountRule']),
    'MatchingRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><MatchingRules xmlns="http://soap.sforce.com/2006/04/metadata"><matchingRules><fullName>AccountRule</fullName></matchingRules></MatchingRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><MatchingRules xmlns="http://soap.sforce.com/2006/04/metadata"></MatchingRules>`,
  ],
  [
    'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
    new Set(['Numbers-fr']),
    'GlobalValueSetTranslation',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><GlobalValueSetTranslation xmlns="http://soap.sforce.com/2006/04/metadata"><valueTranslation><masterLabel>Three</masterLabel><translation>Trois</translation></valueTranslation></GlobalValueSetTranslation>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><GlobalValueSetTranslation xmlns="http://soap.sforce.com/2006/04/metadata"></GlobalValueSetTranslation>`,
  ],
  [
    'force-app/main/default/standardValueSetTranslations/Numbers-fr.standardValueSetTranslation-meta.xml',
    new Set(['Numbers-fr']),
    'StandardValueSetTranslation',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><StandardValueSetTranslation xmlns="http://soap.sforce.com/2006/04/metadata"><valueTranslation><masterLabel>Three</masterLabel><translation>Trois</translation></valueTranslation></StandardValueSetTranslation>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><StandardValueSetTranslation xmlns="http://soap.sforce.com/2006/04/metadata"></StandardValueSetTranslation>`,
  ],
  [
    'force-app/main/default/dashboards/folder/file.dashboard-meta.xml',
    new Set(['folder/file']),
    'Dashboard',
  ],
  [
    'force-app/main/default/reports/folder.reportFolder-meta.xml',
    new Set(['folder']),
    'Report',
  ],
  [
    'force-app/main/default/documents/folder.documentFolder-meta.xml',
    new Set(['folder']),
    'Document',
  ],
  [
    'force-app/main/default/documents/folder/document.test.ext',
    new Set(['folder/document.test']),
    'Document',
  ],
  [
    'force-app/main/default/documents/folder/document.test.document-meta.xml',
    new Set(['folder/document.test']),
    'Document',
  ],
  [
    'force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml',
    new Set(['Account-es']),
    'CustomObjectTranslation',
  ],
  [
    'force-app/main/default/objectTranslations/Account-es/BillingFloor__c.fieldTranslation-meta.xml',
    new Set(['Account-es']),
    'CustomObjectTranslation',
  ],
  [
    'force-app/main/default/staticresources/test/content',
    new Set(['test']),
    'StaticResource',
  ],
  [
    'force-app/main/default/staticresources/resource.js',
    new Set(['resource']),
    'StaticResource',
  ],
  [
    'force-app/main/default/staticresources/erase.resource-meta.xml',
    new Set(['erase']),
    'StaticResource',
  ],
  [
    'force-app/main/default/waveTemplates/WaveTemplateTest/template-info.json',
    new Set(['WaveTemplateTest']),
    'WaveTemplateBundle',
  ],
  [
    'force-app/main/default/lwc/component/component.js-meta.xml',
    new Set(['component']),
    'LightningComponentBundle',
  ],
  [
    'force-app/main/default/aura/component/component.cmp-meta.xml',
    new Set(['component']),
    'AuraDefinitionBundle',
  ],
  [
    'force-app/main/default/experiences/component/subfolder/file.json',
    new Set(['component']),
    'ExperienceBundle',
  ],
  [
    'force-app/main/default/experiences/component-meta.xml',
    new Set(['component']),
    'ExperienceBundle',
  ],
  [
    'force-app/main/default/digitalExperiences/site/component.digitalExperience-meta.xml',
    new Set(['site/component']),
    'DigitalExperienceBundle',
  ],
  [
    'force-app/main/default/digitalExperiences/site/component/workspace/file.json',
    new Set(['site/component']),
    'DigitalExperienceBundle',
  ],
  [
    'force-app/main/default/quickActions/Account.New.quickAction-meta.xml',
    new Set(['Account.New']),
    'QuickAction',
  ],
  [
    'force-app/main/default/quickActions/NewGlobal.quickAction-meta.xml',
    new Set(['NewGlobal']),
    'QuickAction',
  ],
  [
    'force-app/main/default/customMetadata/GraphicsPackImages.md_png.md-meta.xml',
    new Set(['GraphicsPackImages.md_png']),
    'CustomMetadata',
  ],
  [
    'force-app/main/default/objects/Account/weblinks/ClientStore.weblink-meta.xml',
    new Set(['ClientStore']),
    'CustomPageWebLink',
  ],
  [
    'force-app/main/default/classes/controllers/Controller.cls-meta.xml',
    new Set(['Controller']),
    'ApexClass',
  ],
  [
    'force-app/main/default/batchCalcJobDefinitions/Job.batchCalcJobDefinition-meta.xml',
    new Set(['Job']),
    'BatchCalcJobDefinition',
  ],
  [
    'force-app/main/default/restrictionRules/Account.rule-meta.xml',
    new Set(['Account']),
    'RestrictionRule',
  ],
  [
    'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
    new Set(['Account.awesome']),
    'CustomField',
  ],
  [
    'force-app/main/default/objects/Account/indexes/awesome.index-meta.xml',
    new Set(['Account.awesome']),
    'Index',
  ],
  [
    'force-app/main/default/territory2Models/EU/rules/Location.territory2Rule-meta.xml',
    new Set(['EU.Location']),
    'Territory2Rule',
  ],
  [
    'force-app/main/default/territory2Models/EU/territories/France.territory2-meta.xml',
    new Set(['EU.France']),
    'Territory2',
  ],
  [
    'force-app/main/default/objects/Test/Account/fields/awesome.field-meta.xml',
    new Set(['Account.awesome']),
    'CustomField',
  ],
  [
    'force-app/main/default/territory2Models/Test/EU/rules/Location.territory2Rule-meta.xml',
    new Set(['EU.Location']),
    'Territory2Rule',
  ],
  [
    'force-app/main/default/territory2Models/Test/EU/territories/France.territory2-meta.xml',
    new Set(['EU.France']),
    'Territory2',
  ],
  [
    'force-app/main/default/discovery/DiscoveryAIModelTest.model',
    new Set(['DiscoveryAIModelTest']),
    'DiscoveryAIModel',
  ],
  [
    'force-app/main/default/discovery/DiscoveryGoalTest.goal',
    new Set(['DiscoveryGoalTest']),
    'DiscoveryGoal',
  ],
  [
    'force-app/main/default/wave/WaveApplicationTest.wapp',
    new Set(['WaveApplicationTest']),
    'WaveApplication',
  ],
  [
    'force-app/main/default/wave/WaveComponentTest.wcomp',
    new Set(['WaveComponentTest']),
    'WaveComponent',
  ],
  [
    'force-app/main/default/wave/WaveDataflowTest.wdf',
    new Set(['WaveDataflowTest']),
    'WaveDataflow',
  ],
  [
    'force-app/main/default/wave/WaveDashboardTest.wdash',
    new Set(['WaveDashboardTest']),
    'WaveDashboard',
  ],
  [
    'force-app/main/default/wave/WaveDatasetTest.wds',
    new Set(['WaveDatasetTest']),
    'WaveDataset',
  ],
  [
    'force-app/main/default/wave/WaveLensTest.wlens',
    new Set(['WaveLensTest']),
    'WaveLens',
  ],
  [
    'force-app/main/default/wave/WaveRecipeTest.wdpr',
    new Set(['WaveRecipeTest']),
    'WaveRecipe',
  ],
  [
    'force-app/main/default/wave/WaveXmdTest.xmd',
    new Set(['WaveXmdTest']),
    'WaveXmd',
  ],
  [
    'force-app/main/default/discovery/Test/DiscoveryAIModelTest.model',
    new Set(['DiscoveryAIModelTest']),
    'DiscoveryAIModel',
  ],
  [
    'force-app/main/default/discovery/Test/DiscoveryGoalTest.goal',
    new Set(['DiscoveryGoalTest']),
    'DiscoveryGoal',
  ],
  [
    'force-app/main/default/wave/Test/WaveApplicationTest.wapp',
    new Set(['WaveApplicationTest']),
    'WaveApplication',
  ],
  [
    'force-app/main/default/wave/Test/WaveComponentTest.wcomp',
    new Set(['WaveComponentTest']),
    'WaveComponent',
  ],
  [
    'force-app/main/default/wave/Test/WaveDataflowTest.wdf',
    new Set(['WaveDataflowTest']),
    'WaveDataflow',
  ],
  [
    'force-app/main/default/wave/Test/WaveDashboardTest.wdash',
    new Set(['WaveDashboardTest']),
    'WaveDashboard',
  ],
  [
    'force-app/main/default/wave/Test/WaveDatasetTest.wds',
    new Set(['WaveDatasetTest']),
    'WaveDataset',
  ],
  [
    'force-app/main/default/wave/Test/WaveLensTest.wlens',
    new Set(['WaveLensTest']),
    'WaveLens',
  ],
  [
    'force-app/main/default/wave/Test/WaveRecipeTest.wdpr',
    new Set(['WaveRecipeTest']),
    'WaveRecipe',
  ],
  [
    'force-app/main/default/wave/Test/WaveXmdTest.xmd',
    new Set(['WaveXmdTest']),
    'WaveXmd',
  ],
]

let globalMetadata
beforeAll(async () => {
  // eslint-disable-next-line no-undef
  globalMetadata = await getGlobalMetadata()
})
let work
let handlerFactory
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', source: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
  handlerFactory = new HandlerFactory(work, globalMetadata)
})
describe.each(testContext)(
  `integration test %s`,
  (changePath, expected, expectedType, xmlTo, xmlFrom) => {
    test(`addition ${expectedType}`, async () => {
      // Arrange
      if (xmlTo && xmlFrom) {
        readPathFromGit.mockResolvedValueOnce(xmlTo)
        readPathFromGit.mockResolvedValueOnce(xmlFrom)
      }
      const sut = handlerFactory.getTypeHandler(
        `${ADDITION}       ${changePath}`
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get(expectedType)).toEqual(expected)
    })
    test(`deletion ${expectedType}`, async () => {
      // Arrange
      if (xmlTo && xmlFrom) {
        readPathFromGit.mockResolvedValueOnce(xmlFrom)
        readPathFromGit.mockResolvedValueOnce(xmlTo)
      }

      const sut = handlerFactory.getTypeHandler(
        `${DELETION}       ${changePath}`
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.destructiveChanges.get(expectedType)).toEqual(expected)
    })
    test(`modification ${expectedType}`, async () => {
      // Arrange
      if (xmlTo && xmlFrom) {
        readPathFromGit.mockResolvedValueOnce(xmlTo)
        readPathFromGit.mockResolvedValueOnce(xmlFrom)
      }

      const sut = handlerFactory.getTypeHandler(
        `${MODIFICATION}       ${changePath}`
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.get(expectedType)).toEqual(expected)
    })
  }
)
