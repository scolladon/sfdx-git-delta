'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../src/constant/gitConstants'
import { MetadataRepository } from '../../src/metadata/MetadataRepository'
import { getDefinition } from '../../src/metadata/metadataManager'
import TypeHandlerFactory from '../../src/service/typeHandlerFactory'
import { ManifestTarget } from '../../src/types/handlerResult'
import type { Work } from '../../src/types/work'
import { pathExists, readDirs, readPathFromGit } from '../../src/utils/fsHelper'

vi.mock('../../src/utils/fsHelper')

const mockedReadPathFromGit = vi.mocked(readPathFromGit)
const mockedReadDirs = vi.mocked(readDirs)
const mockedPathExists = vi.mocked(pathExists)

const testContext = [
  [
    'force-app/main/default/permissionsets/Admin/objectSettings/Account.Test__c.objectSettings-meta.xml',
    new Set(['Admin']),
    'PermissionSet',
  ],
  [
    'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.Test__c.fieldPermission-meta.xml',
    new Set(['Admin']),
    'PermissionSet',
  ],
  [
    'force-app/main/default/permissionsets/Admin/objectPermissions/Account.objectPermission-meta.xml',
    new Set(['Admin']),
    'PermissionSet',
  ],
  [
    'force-app/main/default/permissionsets/Admin/classAccesses/MyClass.classAccess-meta.xml',
    new Set(['Admin']),
    'PermissionSet',
  ],
  [
    'force-app/main/default/sharingRules/Account/sharingCriteriaRules/TestSharingCriteria.sharingCriteriaRule-meta.xml',
    new Set(['Account.TestSharingCriteria']),
    'SharingCriteriaRule',
  ],
  [
    'force-app/main/default/sharingRules/Account/sharingOwnerRules/TestOwnerRule.sharingOwnerRule-meta.xml',
    new Set(['Account.TestOwnerRule']),
    'SharingOwnerRule',
  ],
  [
    'force-app/main/default/sharingRules/Account/sharingGuestRules/TestGuestRule.sharingGuestRule-meta.xml',
    new Set(['Account.TestGuestRule']),
    'SharingGuestRule',
  ],
  [
    'force-app/main/default/workflows/Account/workflowAlerts/TestWFAlert.workflowAlert-meta.xml',
    new Set(['Account.TestWFAlert']),
    'WorkflowAlert',
  ],
  [
    'force-app/main/default/workflows/Account/workflowFlowActions/TestFlowAction.workflowFlowAction-meta.xml',
    new Set(['Account.TestFlowAction']),
    'WorkflowFlowAction',
  ],
  [
    'force-app/main/default/workflows/Account/workflowFieldUpdates/TestFieldUpdate.workflowFieldUpdate-meta.xml',
    new Set(['Account.TestFieldUpdate']),
    'WorkflowFieldUpdate',
  ],
  [
    'force-app/main/default/workflows/Account/workflowRules/TestRule.workflowRule-meta.xml',
    new Set(['Account.TestRule']),
    'WorkflowRule',
  ],
  [
    'force-app/main/default/workflows/Account/workflowTasks/TestTask.workflowTask-meta.xml',
    new Set(['Account.TestTask']),
    'WorkflowTask',
  ],
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
    'WorkflowKnowledgePublish',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Workflow xmlns="http://soap.sforce.com/2006/04/metadata"><knowledgePublishes><fullName>Test</fullName></knowledgePublishes></Workflow>`,
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
    'force-app/main/default/labels/TestLabel.label-meta.xml',
    new Set(['TestLabel']),
    'CustomLabel',
  ],
  [
    'force-app/main/default/assignmentRules/Account.assignmentRules-meta.xml',
    new Set(['Account.AccountRule']),
    'AssignmentRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata"><assignmentRule><fullName>AccountRule</fullName></assignmentRule></AssignmentRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AssignmentRules xmlns="http://soap.sforce.com/2006/04/metadata"></AssignmentRules>`,
  ],
  [
    'force-app/main/default/autoResponseRules/Account.autoResponseRules-meta.xml',
    new Set(['Account.AccountRule']),
    'AutoResponseRule',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AutoResponseRules xmlns="http://soap.sforce.com/2006/04/metadata"><autoResponseRule><fullName>AccountRule</fullName></autoResponseRule></AutoResponseRules>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><AutoResponseRules xmlns="http://soap.sforce.com/2006/04/metadata"></AutoResponseRules>`,
  ],
  [
    'force-app/main/default/escalationRules/Account.escalationRules-meta.xml',
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
    'force-app/main/default/profiles/Admin.profile-meta.xml',
    new Set(['Admin']),
    'Profile',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"><applicationVisibilities><application>MyApp</application><default>false</default><visible>false</visible></applicationVisibilities></Profile>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Profile xmlns="http://soap.sforce.com/2006/04/metadata"></Profile>`,
  ],
  [
    'force-app/main/default/translations/fr.translation-meta.xml',
    new Set(['fr']),
    'Translations',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><customApplications><label>MyAppLabel</label><name>MyApp</name></customApplications></Translations>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"></Translations>`,
  ],
  [
    'force-app/main/default/objectTranslations/Account-fr/Account-fr.objectTranslation-meta.xml',
    new Set(['Account-fr']),
    'CustomObjectTranslation',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata"><quickActions><label>Nouvelle Relation</label><name>NewRelationship</name></quickActions></CustomObjectTranslation>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata"></CustomObjectTranslation>`,
  ],
  [
    'force-app/main/default/objectTranslations/Account-fr/BillingFloor__c.fieldTranslation-meta.xml',
    new Set(['Account-fr']),
    'CustomObjectTranslation',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata"><quickActions><label>Nouvelle Relation</label><name>NewRelationship</name></quickActions></CustomObjectTranslation>`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata"></CustomObjectTranslation>`,
  ],
  [
    'force-app/main/default/dashboards/folder/file.dashboard-meta.xml',
    new Set(['folder/file']),
    'Dashboard',
  ],
  [
    'force-app/main/default/dashboards/folder.dashboardFolder-meta.xml',
    new Set(['folder']),
    'DashboardFolder',
  ],
  [
    'force-app/main/default/dashboards/folder/folder.dashboardFolder-meta.xml',
    new Set(['folder/folder']),
    'DashboardFolder',
  ],
  [
    'force-app/main/default/reports/folder/file.report-meta.xml',
    new Set(['folder/file']),
    'Report',
  ],
  [
    'force-app/main/default/reports/folder.reportFolder-meta.xml',
    new Set(['folder']),
    'ReportFolder',
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
    'portals/experiences/component/subfolder/file.json',
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
    'force-app/main/default/moderation/site.block.rule-meta.xml',
    new Set(['site.block']),
    'ModerationRule',
  ],
  [
    'force-app/main/default/moderation/site.block.keywords-meta.xml',
    new Set(['site.block']),
    'KeywordList',
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
  [
    'force-app/main/default/featureParameters/FeatureParameterIntegerTest.featureParameterInteger',
    new Set(['FeatureParameterIntegerTest']),
    'FeatureParameterInteger',
  ],
  [
    'force-app/main/default/featureParameters/FeatureParameterBooleanTest.featureParameterBoolean',
    new Set(['FeatureParameterBooleanTest']),
    'FeatureParameterBoolean',
  ],
  [
    'force-app/main/default/featureParameters/FeatureParameterDateTest.featureParameterDate',
    new Set(['FeatureParameterDateTest']),
    'FeatureParameterDate',
  ],
  [
    'force-app/main/default/email/TestFolder/TestEmail.email',
    new Set(['TestFolder/TestEmail']),
    'EmailTemplate',
  ],
  [
    'force-app/main/default/email/TestFolder/TestEmail.email-meta.xml',
    new Set(['TestFolder/TestEmail']),
    'EmailTemplate',
  ],
  [
    'force-app/main/default/email/TestFolder.emailFolder-meta.xml',
    new Set(['TestFolder']),
    'EmailTemplate',
  ],
]
const existingFiles = [
  'force-app/main/default/permissionsets/Admin/Admin.permissionset-meta.xml',
]

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})
let work: Work
let handlerFactory: TypeHandlerFactory
beforeEach(() => {
  vi.resetAllMocks()
  work = {
    config: {
      output: '',
      source: [''],
      repo: '',
      generateDelta: true,
      to: '',
      from: '',
      ignore: '',
      ignoreDestructive: '',
      apiVersion: 0,
      ignoreWhitespace: false,
      include: '',
      includeDestructive: '',
    },
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
  handlerFactory = new TypeHandlerFactory(work, globalMetadata)

  mockedReadPathFromGit.mockResolvedValue('')
  mockedReadDirs.mockResolvedValue(existingFiles)
  mockedPathExists.mockImplementation(path => {
    return Promise.resolve(existingFiles.includes(path))
  })
})
describe.each(testContext)(`integration test %s`, (changePath:
  | string
  | Set<string>, expected: string | Set<string>, expectedType:
  | string
  | Set<string>, xmlTo: string | Set<string>, xmlFrom:
  | string
  | Set<string>) => {
  it(`addition ${expectedType}`, async () => {
    // Arrange
    if (xmlTo && xmlFrom) {
      mockedReadPathFromGit.mockResolvedValueOnce(xmlTo as string)
      mockedReadPathFromGit.mockResolvedValueOnce(xmlFrom as string)
    }
    const sut = await handlerFactory.getTypeHandler(
      `${ADDITION}       ${changePath}`
    )

    // Act
    const result = await sut.collect()

    // Assert
    const members = new Set(
      result.changes
        .toElements()
        .filter(
          m => m.target === ManifestTarget.Package && m.type === expectedType
        )
        .map(m => m.member)
    )
    expect(members).toEqual(expected)
  })
  it(`deletion ${expectedType}`, async () => {
    // Arrange
    if (xmlTo && xmlFrom) {
      mockedReadPathFromGit.mockResolvedValueOnce(xmlFrom as string)
      mockedReadPathFromGit.mockResolvedValueOnce(xmlTo as string)
    }

    mockedReadDirs.mockResolvedValue([])
    mockedPathExists.mockResolvedValue(false)

    const sut = await handlerFactory.getTypeHandler(
      `${DELETION}       ${changePath}`
    )

    // Act
    const result = await sut.collect()

    // Assert
    const members = new Set(
      result.changes
        .toElements()
        .filter(
          m =>
            m.target === ManifestTarget.DestructiveChanges &&
            m.type === expectedType
        )
        .map(m => m.member)
    )
    expect(members).toEqual(expected)
  })
  it(`modification ${expectedType}`, async () => {
    // Arrange
    if (xmlTo && xmlFrom) {
      mockedReadPathFromGit.mockResolvedValueOnce(xmlTo as string)
      mockedReadPathFromGit.mockResolvedValueOnce(xmlFrom as string)
    }

    const sut = await handlerFactory.getTypeHandler(
      `${MODIFICATION}       ${changePath}`
    )

    // Act
    const result = await sut.collect()

    // Assert
    const members = new Set(
      result.changes
        .toElements()
        .filter(
          m => m.target === ManifestTarget.Package && m.type === expectedType
        )
        .map(m => m.member)
    )
    expect(members).toEqual(expected)
  })
})

describe('InFile container manifest under generateDelta=false', () => {
  // End-to-end lock: real TypeHandlerFactory + real InFileHandler + real
  // MetadataDiff. When a SharingRules file gains a new sharingCriteriaRules
  // child while keeping pre-existing siblings, both the parent SharingRules
  // entry AND the new SharingCriteriaRule member must appear in package.xml
  // — even when generateDelta is off (the user-facing programmatic mode and
  // the CLI default). Without the parent entry, Salesforce rejects the
  // deploy with 'pre-existing sibling Not in package.xml'.
  it('Given a new sharingCriteriaRules added to a file with an existing sibling and generateDelta=false, When the handler collects, Then both SharingRules and SharingCriteriaRule appear in the package manifest', async () => {
    // Arrange
    work.config.generateDelta = false
    const path =
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml'
    const ns = 'xmlns="http://soap.sforce.com/2006/04/metadata"'
    const header = '<?xml version="1.0" encoding="UTF-8"?>'
    const fromXml = `${header}<SharingRules ${ns}><sharingCriteriaRules><fullName>Existing</fullName></sharingCriteriaRules></SharingRules>`
    const toXml = `${header}<SharingRules ${ns}><sharingCriteriaRules><fullName>Existing</fullName></sharingCriteriaRules><sharingCriteriaRules><fullName>NewlyAdded</fullName></sharingCriteriaRules></SharingRules>`
    mockedReadPathFromGit.mockResolvedValueOnce(toXml)
    mockedReadPathFromGit.mockResolvedValueOnce(fromXml)
    const sut = await handlerFactory.getTypeHandler(
      `${MODIFICATION}       ${path}`
    )

    // Act
    const result = await sut.collect()

    // Assert — package manifest must contain both the parent container
    // and the newly added child sub-element.
    const packageEntries = result.changes
      .toElements()
      .filter(m => m.target === ManifestTarget.Package)
    expect(packageEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SharingRules', member: 'Account' }),
        expect.objectContaining({
          type: 'SharingCriteriaRule',
          member: 'Account.NewlyAdded',
        }),
      ])
    )
  })

  it('Given an existing sharingCriteriaRules whose content is modified and generateDelta=false, When the handler collects, Then both SharingRules and SharingCriteriaRule appear in the package manifest', async () => {
    // Locks the recordModified flag-set path: when a child's content
    // changes (no add, no delete), hasSurvivingChange must still flip
    // and the parent must still go in package.xml.
    work.config.generateDelta = false
    const path =
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml'
    const ns = 'xmlns="http://soap.sforce.com/2006/04/metadata"'
    const header = '<?xml version="1.0" encoding="UTF-8"?>'
    const fromXml = `${header}<SharingRules ${ns}><sharingCriteriaRules><fullName>Existing</fullName><accessLevel>Read</accessLevel></sharingCriteriaRules></SharingRules>`
    const toXml = `${header}<SharingRules ${ns}><sharingCriteriaRules><fullName>Existing</fullName><accessLevel>Edit</accessLevel></sharingCriteriaRules></SharingRules>`
    mockedReadPathFromGit.mockResolvedValueOnce(toXml)
    mockedReadPathFromGit.mockResolvedValueOnce(fromXml)
    const sut = await handlerFactory.getTypeHandler(
      `${MODIFICATION}       ${path}`
    )

    // Act
    const result = await sut.collect()

    // Assert
    const packageEntries = result.changes
      .toElements()
      .filter(m => m.target === ManifestTarget.Package)
    expect(packageEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SharingRules', member: 'Account' }),
        expect.objectContaining({
          type: 'SharingCriteriaRule',
          member: 'Account.Existing',
        }),
      ])
    )
  })

  it('Given a sharingCriteriaRules removed in to (sibling preserved) and generateDelta=false, When the handler collects, Then the deleted child goes to destructiveChanges and the parent is NOT listed in either manifest', async () => {
    // Locks deletion semantics: recordDeleted must NOT flip
    // hasSurvivingChange. The deleted child belongs in
    // destructiveChanges.xml only; the parent SharingRules file still
    // exists on disk with its surviving sibling, so it must NOT appear
    // in package.xml (nothing to deploy) NOR in destructiveChanges.xml
    // (the file isn't being deleted, just one child).
    work.config.generateDelta = false
    const path =
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml'
    const ns = 'xmlns="http://soap.sforce.com/2006/04/metadata"'
    const header = '<?xml version="1.0" encoding="UTF-8"?>'
    const fromXml = `${header}<SharingRules ${ns}><sharingCriteriaRules><fullName>Kept</fullName></sharingCriteriaRules><sharingCriteriaRules><fullName>Gone</fullName></sharingCriteriaRules></SharingRules>`
    const toXml = `${header}<SharingRules ${ns}><sharingCriteriaRules><fullName>Kept</fullName></sharingCriteriaRules></SharingRules>`
    mockedReadPathFromGit.mockResolvedValueOnce(toXml)
    mockedReadPathFromGit.mockResolvedValueOnce(fromXml)
    const sut = await handlerFactory.getTypeHandler(
      `${MODIFICATION}       ${path}`
    )

    // Act
    const result = await sut.collect()

    // Assert — child in destructiveChanges, no parent anywhere.
    const elements = result.changes.toElements()
    const destructive = elements.filter(
      m => m.target === ManifestTarget.DestructiveChanges
    )
    const packageEntries = elements.filter(
      m => m.target === ManifestTarget.Package
    )
    expect(destructive).toEqual([
      expect.objectContaining({
        type: 'SharingCriteriaRule',
        member: 'Account.Gone',
      }),
    ])
    expect(packageEntries).toEqual([])
  })
})
