'use strict'
const BotHandler = require('../../src/service/botHandler')
const CustomObjectHandler = require('../../src/service/customObjectHandler')
const InBundleHandler = require('../../src/service/inBundleHandler')
const InFileHandler = require('../../src/service/inFileHandler')
const InFolderHandler = require('../../src/service/inFolderHandler')
const InTranslationHandler = require('../../src/service/inTranslationHandler')
const InResourceHandler = require('../../src/service/inResourceHandler')
const StandardHandler = require('../../src/service/standardHandler')
const SubCustomObjectHandler = require('../../src/service/subCustomObjectHandler')
const WaveHandler = require('../../src/service/waveHandler')
const fileGitDiff = require('../../src/utils/fileGitDiff')
const { EOL } = require('os')
const {
  ADDITION,
  DELETION,
  MODIFICATION,
  MINUS,
  PLUS,
} = require('../../src/utils/gitConstants')
jest.mock('../../src/utils/fileGitDiff')

const testContext = [
  [
    BotHandler,
    [
      [
        'bots',
        'force-app/main/default/bots/TestBot/TestBot.bot-meta.xml',
        new Set(['TestBot']),
        'Bot',
      ],
      [
        'bots',
        'force-app/main/default/bots/TestBot/v1.botVersion-meta.xml',
        new Set(['TestBot.v1']),
        'BotVersion',
      ],
    ],
  ],
  [
    CustomObjectHandler,
    [
      [
        'objects',
        'force-app/main/default/objects/Account/Account.object-meta.xml',
        new Set(['Account']),
      ],
      [
        'objects',
        'force-app/main/default/objects/Test/Account/Account.object-meta.xml',
        new Set(['Account']),
      ],
      [
        'territory2Models',
        'force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
        new Set(['EU']),
      ],
    ],
  ],
  [
    InFileHandler,
    [
      [
        'workflows',
        'force-app/main/default/workflows/Account.workflow-meta.xml',
        new Set(['Account.Test']),
        'workflows.alerts',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<alerts>${EOL}<fullName>Test</fullName>${EOL}</alerts>${EOL}</Workflow>`,
      ],
      [
        'workflows',
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        new Set(['Account.Test']),
        'workflows.fieldUpdates',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<fieldUpdates>${EOL}<fullName>Test</fullName>${EOL}</fieldUpdates>${EOL}</Workflow>`,
      ],
      [
        'workflows',
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        new Set(['Account.Test']),
        'workflows.outboundMessages',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<outboundMessages>${EOL}<fullName>Test</fullName>${EOL}</outboundMessages>${EOL}</Workflow>`,
      ],
      [
        'workflows',
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        new Set(['Account.Test']),
        'workflows.rules',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<rules>${EOL}<fullName>Test</fullName>${EOL}</rules>${EOL}</Workflow>`,
      ],
      [
        'workflows',
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        new Set(['Account.Test']),
        'workflows.flowActions',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<flowActions>${EOL}<fullName>Test</fullName>${EOL}</flowActions>${EOL}</Workflow>`,
      ],
      [
        'labels',
        'force-app/main/default/labels/CustomLabels.labels-meta.xml',
        new Set(['Label']),
        'labels.labels',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<labels>${EOL}<fullName>Label</fullName>${EOL}</labels>${EOL}</CustomLabels>`,
      ],
      [
        'sharingRules',
        'force-app/main/default/sharingRules/Account.sharingRules-meta.xml',
        new Set(['Account.Criteria']),
        'sharingRules.sharingCriteriaRules',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<sharingCriteriaRules>${EOL}<fullName>Criteria</fullName>${EOL}</sharingCriteriaRules>${EOL}</SharingRules>`,
      ],
      [
        'sharingRules',
        'force-app/main/default/sharingRules/Test/Account.sharingRules-meta.xml',
        new Set(['Account.Criteria']),
        'sharingRules.sharingCriteriaRules',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<sharingCriteriaRules>${EOL}<fullName>Criteria</fullName>${EOL}</sharingCriteriaRules>${EOL}</SharingRules>`,
      ],
    ],
  ],
  [
    InFolderHandler,
    [
      [
        'dashboards',
        'force-app/main/default/dashboards/folder/file.dashboard-meta.xml',
        new Set(['folder/file']),
      ],
      [
        'reports',
        'force-app/main/default/reports/folder.reportFolder-meta.xml',
        new Set(['folder']),
      ],
      [
        'documents',
        'force-app/main/default/documents/folder.documentFolder-meta.xml',
        new Set(['folder']),
      ],
      [
        'documents',
        'force-app/main/default/documents/folder/document.test.ext',
        new Set(['folder/document.test']),
      ],
      [
        'documents',
        'force-app/main/default/documents/folder/document.test.document-meta.xml',
        new Set(['folder/document.test']),
      ],
    ],
  ],
  [
    InTranslationHandler,
    [
      [
        'objectTranslations',
        'force-app/main/default/objectTranslations/Account-es/Account-es.objectTranslation-meta.xml',
        new Set(['Account-es']),
      ],
      [
        'objectTranslations',
        'force-app/main/default/objectTranslations/Account-es/BillingFloor__c.fieldTranslation-meta.xml',
        new Set(['Account-es']),
      ],
    ],
  ],
  [
    InResourceHandler,
    [
      [
        'staticresources',
        'force-app/main/default/staticresources/test/content',
        new Set(['test']),
      ],
      [
        'staticresources',
        'force-app/main/default/staticresources/resource.js',
        new Set(['resource']),
      ],
      [
        'staticresources',
        'force-app/main/default/staticresources/erase.resource-meta.xml',
        new Set(['erase']),
      ],
      [
        'waveTemplates',
        'force-app/main/default/waveTemplates/WaveTemplateTest/template-info.json',
        new Set(['WaveTemplateTest']),
      ],
      [
        'lwc',
        'force-app/main/default/lwc/component/component.js-meta.xml',
        new Set(['component']),
      ],
      [
        'aura',
        'force-app/main/default/aura/component/component.cmp-meta.xml',
        new Set(['component']),
      ],
      [
        'experiences',
        'force-app/main/default/experiences/component/subfolder/file.json',
        new Set(['component']),
      ],
      [
        'experiences',
        'force-app/main/default/experiences/component-meta.xml',
        new Set(['component']),
      ],
    ],
  ],
  [
    InBundleHandler,
    [
      [
        'digitalExperiences',
        'force-app/main/default/digitalExperiences/site/component.digitalExperience-meta.xml',
        new Set(['site/component']),
      ],
      [
        'digitalExperiences',
        'force-app/main/default/digitalExperiences/site/component/workspace/file.json',
        new Set(['site/component']),
      ],
    ],
  ],
  [
    StandardHandler,
    [
      [
        'quickActions',
        'force-app/main/default/quickActions/Account.New.quickAction-meta.xml',
        new Set(['Account.New']),
      ],
      [
        'quickActions',
        'force-app/main/default/quickActions/NewGlobal.quickAction-meta.xml',
        new Set(['NewGlobal']),
      ],
      [
        'customMetadata',
        'force-app/main/default/customMetadata/GraphicsPackImages.md_png.md-meta.xml',
        new Set(['GraphicsPackImages.md_png']),
      ],
      [
        'weblinks',
        'force-app/main/default/objects/Account/weblinks/ClientStore.weblink-meta.xml',
        new Set(['ClientStore']),
      ],
      [
        'classes',
        'force-app/main/default/classes/controllers/Controller.cls-meta.xml',
        new Set(['Controller']),
      ],
      [
        'batchCalcJobDefinitions',
        'force-app/main/default/batchCalcJobDefinitions/Job.batchCalcJobDefinition-meta.xml',
        new Set(['Job']),
      ],
      [
        'restrictionRules',
        'force-app/main/default/restrictionRules/Account.rule-meta.xml',
        new Set(['Account']),
      ],
    ],
  ],
  [
    SubCustomObjectHandler,
    [
      [
        'fields',
        'force-app/main/default/objects/Account/fields/awesome.field-meta.xml',
        new Set(['Account.awesome']),
      ],
      [
        'indexes',
        'force-app/main/default/objects/Account/indexes/awesome.index-meta.xml',
        new Set(['Account.awesome']),
      ],
      [
        'rules',
        'force-app/main/default/territory2Models/EU/rules/Location.territory2Rule-meta.xml',
        new Set(['EU.Location']),
      ],
      [
        'territories',
        'force-app/main/default/territory2Models/EU/territories/France.territory2-meta.xml',
        new Set(['EU.France']),
      ],
      [
        'fields',
        'force-app/main/default/objects/Test/Account/fields/awesome.field-meta.xml',
        new Set(['Account.awesome']),
      ],
      [
        'rules',
        'force-app/main/default/territory2Models/Test/EU/rules/Location.territory2Rule-meta.xml',
        new Set(['EU.Location']),
      ],
      [
        'territories',
        'force-app/main/default/territory2Models/Test/EU/territories/France.territory2-meta.xml',
        new Set(['EU.France']),
      ],
    ],
  ],
  [
    WaveHandler,
    [
      [
        'discovery',
        'force-app/main/default/discovery/DiscoveryAIModelTest.model',
        new Set(['DiscoveryAIModelTest']),
        'DiscoveryAIModel',
      ],
      [
        'discovery',
        'force-app/main/default/discovery/DiscoveryGoalTest.goal',
        new Set(['DiscoveryGoalTest']),
        'DiscoveryGoal',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveApplicationTest.wapp',
        new Set(['WaveApplicationTest']),
        'WaveApplication',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveComponentTest.wcomp',
        new Set(['WaveComponentTest']),
        'WaveComponent',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveDataflowTest.wdf',
        new Set(['WaveDataflowTest']),
        'WaveDataflow',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveDashboardTest.wdash',
        new Set(['WaveDashboardTest']),
        'WaveDashboard',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveDatasetTest.wds',
        new Set(['WaveDatasetTest']),
        'WaveDataset',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveLensTest.wlens',
        new Set(['WaveLensTest']),
        'WaveLens',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveRecipeTest.wdpr',
        new Set(['WaveRecipeTest']),
        'WaveRecipe',
      ],
      [
        'wave',
        'force-app/main/default/wave/WaveXmdTest.xmd',
        new Set(['WaveXmdTest']),
        'WaveXmd',
      ],
      [
        'discovery',
        'force-app/main/default/discovery/Test/DiscoveryAIModelTest.model',
        new Set(['DiscoveryAIModelTest']),
        'DiscoveryAIModel',
      ],
      [
        'discovery',
        'force-app/main/default/discovery/Test/DiscoveryGoalTest.goal',
        new Set(['DiscoveryGoalTest']),
        'DiscoveryGoal',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveApplicationTest.wapp',
        new Set(['WaveApplicationTest']),
        'WaveApplication',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveComponentTest.wcomp',
        new Set(['WaveComponentTest']),
        'WaveComponent',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveDataflowTest.wdf',
        new Set(['WaveDataflowTest']),
        'WaveDataflow',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveDashboardTest.wdash',
        new Set(['WaveDashboardTest']),
        'WaveDashboard',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveDatasetTest.wds',
        new Set(['WaveDatasetTest']),
        'WaveDataset',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveLensTest.wlens',
        new Set(['WaveLensTest']),
        'WaveLens',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveRecipeTest.wdpr',
        new Set(['WaveRecipeTest']),
        'WaveRecipe',
      ],
      [
        'wave',
        'force-app/main/default/wave/Test/WaveXmdTest.xmd',
        new Set(['WaveXmdTest']),
        'WaveXmd',
      ],
    ],
  ],
]

let globalMetadata
let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', source: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
})
beforeAll(async () => {
  // eslint-disable-next-line no-undef
  globalMetadata = await getGlobalMetadata()
})
describe.each(testContext)('integration domain test', (handler, testData) => {
  describe(`${handler.name}`, () => {
    describe.each(testData)(
      '%s',
      (type, changePath, expected, expectedType, xmlContent) => {
        test('addition', async () => {
          // Arrange
          fileGitDiff.mockImplementation(() =>
            xmlContent?.split(EOL).map(x => `${PLUS} ${x}`)
          )
          const sut = new handler(
            `${ADDITION}       ${changePath}`,
            type,
            work,
            globalMetadata
          )

          // Act
          await sut.handle()

          // Assert
          expect(work.diffs.package.get(expectedType ?? type)).toEqual(expected)
        })
        test('deletion', async () => {
          // Arrange
          fileGitDiff.mockImplementation(() =>
            xmlContent?.split(EOL).map(x => `${MINUS} ${x}`)
          )

          const sut = new handler(
            `${DELETION}       ${changePath}`,
            type,
            work,
            globalMetadata
          )

          // Act
          await sut.handle()

          // Assert
          expect(
            work.diffs.destructiveChanges.get(expectedType ?? type)
          ).toEqual(expected)
        })
        test('modification', async () => {
          // Arrange
          fileGitDiff.mockImplementation(() =>
            xmlContent?.split(EOL).map(x => `${PLUS} ${x}`)
          )
          const sut = new handler(
            `${MODIFICATION}       ${changePath}`,
            type,
            work,
            globalMetadata
          )

          // Act
          await sut.handle()

          // Assert
          expect(work.diffs.package.get(expectedType ?? type)).toEqual(expected)
        })
      }
    )
  })
})
