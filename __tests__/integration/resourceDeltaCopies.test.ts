'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import type { FixtureOp } from '../__utils__/gitFixtureRepo'
import { FIXTURE_HOOK_BUDGET_MS } from '../__utils__/gitFixtureRepo'
import {
  add,
  DEFAULT_ROOT,
  type FixtureFile,
  file,
  LWC_CSS,
  LWC_JS_CHANGED,
  lwcFiles,
  PROJECT_FILE,
  projectJson,
  remove,
  type ScenarioRefs,
} from '../__utils__/pureMoveFixtureRepo'
import {
  expectOutcome,
  type Outcome,
  usePureMoveHarness,
} from '../__utils__/pureMoveHarness'

const PROJECT = file(PROJECT_FILE, projectJson(['force-app']))
const { build, outcomeOf, copiedContentOf } =
  usePureMoveHarness('resource-copies')

const at = (path: string, content: string): FixtureFile =>
  file(`${DEFAULT_ROOT}/${path}`, content)

const STATIC = 'staticresources'
const RESOURCE_META = '<StaticResource/>\n'
const LIB = [
  at(`${STATIC}/Lib/a.js`, 'a\n'),
  at(`${STATIC}/Lib/b.js`, 'b\n'),
  at(`${STATIC}/Lib/c.js`, 'c\n'),
  at(`${STATIC}/Lib.resource-meta.xml`, RESOURCE_META),
] as const
const LIBRARY = [
  at(`${STATIC}/Library/x.js`, 'x\n'),
  at(`${STATIC}/Library.resource-meta.xml`, RESOURCE_META),
] as const
const LOGO = [
  at(`${STATIC}/Logo.png`, 'png\n'),
  at(`${STATIC}/Logo.resource-meta.xml`, RESOURCE_META),
] as const

const CMP = lwcFiles(DEFAULT_ROOT, 'cmp')
const AURA_DIR = `${DEFAULT_ROOT}/aura/auraCmp`
const AURA = [
  file(`${AURA_DIR}/auraCmp.cmp`, '<aura:component/>\n'),
  file(`${AURA_DIR}/auraCmp.cmp-meta.xml`, '<AuraDefinitionBundle/>\n'),
  file(`${AURA_DIR}/auraCmpController.js`, '({})\n'),
] as const

const SITE_DIR = `${DEFAULT_ROOT}/digitalExperiences/site/Site_A`
const PAGE_A = `${SITE_DIR}/sfdc_cms__view/page_a`
const PAGE_B = `${SITE_DIR}/sfdc_cms__view/page_b`
const BUNDLE_META = `${SITE_DIR}/Site_A.digitalExperience-meta.xml`
const DEB = [
  file(BUNDLE_META, '<DigitalExperienceBundle/>\n'),
  file(`${PAGE_A}/content.json`, '{"a":1}\n'),
  file(`${PAGE_A}/_meta.json`, '{"m":1}\n'),
  file(`${PAGE_A}/mobile/mobile.json`, '{"mo":1}\n'),
  file(`${PAGE_B}/content.json`, '{"b":1}\n'),
  file(`${PAGE_B}/_meta.json`, '{"bm":1}\n'),
] as const

const TRANSLATION_DIR = `${DEFAULT_ROOT}/objectTranslations/Account-es`
const FIELD_TRANSLATION = `${TRANSLATION_DIR}/Name.fieldTranslation-meta.xml`
const TRANSLATION = [
  file(
    `${TRANSLATION_DIR}/Account-es.objectTranslation-meta.xml`,
    '<?xml version="1.0" encoding="UTF-8"?>\n<CustomObjectTranslation xmlns="http://soap.sforce.com/2006/04/metadata">\n    <fields>\n        <name>Name</name>\n    </fields>\n</CustomObjectTranslation>\n'
  ),
  file(
    FIELD_TRANSLATION,
    '<?xml version="1.0" encoding="UTF-8"?>\n<CustomFieldTranslation xmlns="http://soap.sforce.com/2006/04/metadata">\n    <label>Account name</label>\n    <name>Name</name>\n</CustomFieldTranslation>\n'
  ),
] as const
const TRANSLATION_EDITED = TRANSLATION[1].content.replace(
  'Account name',
  'Customer name'
)

const pathOf = ({ path }: FixtureFile): string => path
const pathsOf = (files: readonly FixtureFile[]): string[] =>
  files.map(pathOf).sort()
const contentsOf = (files: readonly FixtureFile[]): Record<string, string> =>
  Object.fromEntries(files.map(({ path, content }) => [path, content]))
const edit = (target: FixtureFile): FixtureOp =>
  add(target.path, `${target.content}edited\n`)
const editedAtTo = (
  files: readonly FixtureFile[],
  edited: readonly FixtureFile[]
): FixtureFile[] =>
  files.map(original =>
    edited.includes(original)
      ? { ...original, content: `${original.content}edited\n` }
      : original
  )

type Case = {
  title: string
  base: readonly FixtureFile[]
  change: readonly FixtureOp[]
  copiedAtTo: readonly FixtureFile[]
  expected: Partial<Outcome>
  verifyBytes?: boolean
  generateDelta?: boolean
}

const [LIB_A, LIB_B, LIB_C, LIB_META] = LIB
const LIB_PKG = {
  pkg: ['StaticResource:Lib'],
  changes: ['modify:StaticResource:Lib'],
}
const LWC_AT_TO = CMP.map(original =>
  original.path.endsWith('.js')
    ? { ...original, content: LWC_JS_CHANGED }
    : original
).concat(at('lwc/cmp/cmp.css', LWC_CSS))
const cases: readonly Case[] = [
  {
    title: 'a StaticResource folder with two of three files edited',
    base: [PROJECT, ...LIB],
    change: [edit(LIB_A), edit(LIB_B)],
    copiedAtTo: editedAtTo(LIB, [LIB_A, LIB_B]),
    expected: LIB_PKG,
  },
  {
    title: 'a single-file StaticResource whose meta is edited',
    base: [PROJECT, ...LOGO],
    change: [edit(LOGO[1])],
    copiedAtTo: editedAtTo(LOGO, [LOGO[1]]),
    expected: {
      pkg: ['StaticResource:Logo'],
      changes: ['modify:StaticResource:Logo'],
    },
  },
  {
    title: 'a StaticResource beside a prefix-sharing sibling',
    base: [PROJECT, ...LIB, ...LIBRARY],
    change: [edit(LIB_A)],
    copiedAtTo: editedAtTo(LIB, [LIB_A]),
    expected: LIB_PKG,
  },
  {
    title: 'a StaticResource folder with one of three files removed',
    base: [PROJECT, ...LIB],
    change: [remove(LIB_C.path)],
    copiedAtTo: [LIB_A, LIB_B, LIB_META],
    expected: { ...LIB_PKG, changes: ['delete:StaticResource:Lib'] },
  },
  {
    title: 'a StaticResource folder removed entirely',
    base: [PROJECT, ...LIB],
    change: LIB.map(({ path }) => remove(path)),
    copiedAtTo: [],
    expected: {
      destructive: ['StaticResource:Lib'],
      changes: ['delete:StaticResource:Lib'],
    },
  },
  {
    title: 'an LWC bundle with its js edited and a css added',
    base: [PROJECT, ...CMP],
    change: [
      add(
        CMP.find(({ path }) => path.endsWith('.js'))?.path ?? '',
        LWC_JS_CHANGED
      ),
      add(`${DEFAULT_ROOT}/lwc/cmp/cmp.css`, LWC_CSS),
    ],
    copiedAtTo: LWC_AT_TO,
    expected: {
      pkg: ['LightningComponentBundle:cmp'],
      changes: [
        'add:LightningComponentBundle:cmp',
        'modify:LightningComponentBundle:cmp',
      ],
    },
  },
  {
    title: 'an Aura bundle with its cmp edited',
    base: [PROJECT, ...AURA],
    change: [edit(AURA[0])],
    copiedAtTo: editedAtTo(AURA, [AURA[0]]),
    expected: {
      pkg: ['AuraDefinitionBundle:auraCmp'],
      changes: ['modify:AuraDefinitionBundle:auraCmp'],
    },
  },
  {
    title: 'a DigitalExperience page content edited',
    base: [PROJECT, ...DEB],
    change: [edit(DEB[1])],
    copiedAtTo: editedAtTo(DEB.slice(1, 4), [DEB[1]]),
    expected: {
      pkg: ['DigitalExperience:site/Site_A.sfdc_cms__view/page_a'],
      changes: ['modify:DigitalExperience:site/Site_A.sfdc_cms__view/page_a'],
    },
  },
  {
    title: 'a DigitalExperience bundle meta and one page edited in one diff',
    base: [PROJECT, ...DEB],
    change: [edit(DEB[0]), edit(DEB[1])],
    copiedAtTo: editedAtTo(DEB, [DEB[0], DEB[1]]),
    expected: {
      pkg: ['DigitalExperienceBundle:site/Site_A'],
      changes: ['modify:DigitalExperienceBundle:site/Site_A'],
    },
  },
  {
    title: 'a CustomObjectTranslation field translation edited',
    base: [PROJECT, ...TRANSLATION],
    change: [add(FIELD_TRANSLATION, TRANSLATION_EDITED)],
    copiedAtTo: TRANSLATION,
    expected: {
      pkg: ['CustomObjectTranslation:Account-es'],
      changes: ['modify:CustomObjectTranslation:Account-es'],
    },
    verifyBytes: false,
  },
  {
    title: 'the StaticResource folder edit with generate-delta off',
    base: [PROJECT, ...LIB],
    change: [edit(LIB_A), edit(LIB_B)],
    copiedAtTo: [],
    expected: LIB_PKG,
    generateDelta: false,
  },
]

describe.each(cases)('Given $title', testCase => {
  const { base, change, copiedAtTo, expected, generateDelta } = testCase
  let refs: ScenarioRefs
  const overrides = generateDelta === false ? { generateDelta } : {}
  beforeAll(() => {
    refs = build(testCase.title.slice(0, 40), base, change)
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When sgd runs, Then the manifests and the copied list match', async () => {
    // Act
    const result = await outcomeOf({ refs, overrides })

    // Assert
    expectOutcome(result, { ...expected, copied: pathsOf(copiedAtTo) })
  })

  it.skipIf(testCase.verifyBytes === false)(
    'When sgd runs, Then the copied bytes match the to state',
    async () => {
      // Act
      const result = await copiedContentOf({ refs, overrides })

      // Assert
      expect(result).toEqual(contentsOf(copiedAtTo))
    }
  )
})
