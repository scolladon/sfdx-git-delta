'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_HOOK_BUDGET_MS } from '../__utils__/gitFixtureRepo'
import {
  add,
  CLASS_BODY_CHANGED,
  CLASS_META_CHANGED,
  classFiles,
  DEFAULT_ROOT,
  FIELD_META,
  file,
  LWC_CSS,
  LWC_JS_CHANGED,
  lwcFiles,
  MOVED_ROOT,
  move,
  movesOf,
  PROJECT_FILE,
  projectJson,
  REPORT_FOLDER_META,
  REPORT_META,
  remove,
  type ScenarioRefs,
} from '../__utils__/pureMoveFixtureRepo'
import {
  type Case,
  expectOutcome,
  type Outcome,
  usePureMoveHarness,
} from '../__utils__/pureMoveHarness'

const SINGLE_ENTRY = projectJson(['force-app'])
const PROJECT = file(PROJECT_FILE, SINGLE_ENTRY)
const { build, outcomeOf, ignoreOverrides } = usePureMoveHarness('pure-move')

const FOO = classFiles(DEFAULT_ROOT, 'Foo')
const FOO_MOVED_PATHS = FOO.map(({ path }) =>
  path.replace(DEFAULT_ROOT, MOVED_ROOT)
)
const FOO_MOVE = movesOf(FOO, DEFAULT_ROOT, MOVED_ROOT)
const FOO_DEPLOYED: Partial<Outcome> = {
  pkg: ['ApexClass:Foo'],
  copied: FOO_MOVED_PATHS,
  changes: ['add:ApexClass:Foo'],
}

describe('Given a class moved between two directories of one package directory', () => {
  let refs: ScenarioRefs
  beforeAll(() => {
    refs = build('class-pure', [PROJECT, ...FOO], FOO_MOVE)
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When both files are identical, Then nothing is deployed, destructed or copied', async () => {
    // Act
    const result = await outcomeOf({ refs })

    // Assert
    expectOutcome(result, {})
  })
})

describe('Given a class moved with a content change', () => {
  let bodyRefs: ScenarioRefs
  let metaRefs: ScenarioRefs
  let partialRefs: ScenarioRefs
  beforeAll(() => {
    bodyRefs = build(
      'class-body',
      [PROJECT, ...FOO],
      [...FOO_MOVE, add(FOO_MOVED_PATHS[0] as string, CLASS_BODY_CHANGED)]
    )
    metaRefs = build(
      'class-meta',
      [PROJECT, ...FOO],
      [...FOO_MOVE, add(FOO_MOVED_PATHS[1] as string, CLASS_META_CHANGED)]
    )
    partialRefs = build(
      'class-partial',
      [PROJECT, ...FOO],
      [move(FOO[0]?.path as string, FOO_MOVED_PATHS[0] as string)]
    )
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When the class body changes, Then the class is deployed and copied without a destructive entry', async () => {
    // Act
    const result = await outcomeOf({ refs: bodyRefs })

    // Assert
    expectOutcome(result, FOO_DEPLOYED)
  })

  it('When only the meta file changes, Then the class is deployed and copied', async () => {
    // Act
    const result = await outcomeOf({ refs: metaRefs })

    // Assert
    expectOutcome(result, FOO_DEPLOYED)
  })

  it('When only the class file moves and its meta file stays, Then the class is deployed and the moved file copied', async () => {
    // Act
    const result = await outcomeOf({ refs: partialRefs })

    // Assert
    expectOutcome(result, {
      pkg: ['ApexClass:Foo'],
      copied: [FOO_MOVED_PATHS[0] as string],
      changes: ['add:ApexClass:Foo'],
    })
  })
})

const BILLING_ROOT = 'billing/main/default'
const BILLING_FOO_PATHS = FOO.map(({ path }) =>
  path.replace(DEFAULT_ROOT, BILLING_ROOT)
)
const BILLING_FOO_DEPLOYED: Partial<Outcome> = {
  pkg: ['ApexClass:Foo'],
  copied: BILLING_FOO_PATHS,
  changes: ['add:ApexClass:Foo'],
}

const FIELD_PATH = `${DEFAULT_ROOT}/objects/Account/fields/S__c.field-meta.xml`
const FIELD_MOVED = `${MOVED_ROOT}/objects/Account/fields/S__c.field-meta.xml`
const CMP = lwcFiles(DEFAULT_ROOT, 'cmp')
const CMP_MOVE = movesOf(CMP, DEFAULT_ROOT, MOVED_ROOT)
const CMP_MOVED_PATHS = CMP.map(({ path }) =>
  path.replace(DEFAULT_ROOT, MOVED_ROOT)
)
const CMP_DEPLOYED = (copied: readonly string[]): Partial<Outcome> => ({
  pkg: ['LightningComponentBundle:cmp'],
  copied: [...copied].sort(),
  changes: ['add:LightningComponentBundle:cmp'],
})

const componentCases: readonly Case[] = [
  {
    title:
      'a custom field moved between object directories of one package directory is neither deployed nor copied',
    base: [PROJECT, file(FIELD_PATH, FIELD_META)],
    change: [move(FIELD_PATH, FIELD_MOVED)],
    expected: {},
  },
  {
    title: 'an identical bundle moved is neither deployed nor copied',
    base: [PROJECT, ...CMP],
    change: CMP_MOVE,
    expected: {},
  },
  {
    title: 'a bundle moved with one file changed is deployed whole',
    base: [PROJECT, ...CMP],
    change: [...CMP_MOVE, add(CMP_MOVED_PATHS[0] as string, LWC_JS_CHANGED)],
    expected: CMP_DEPLOYED(CMP_MOVED_PATHS),
  },
  {
    title: 'a bundle moved with one file added is deployed whole',
    base: [PROJECT, ...CMP],
    change: [...CMP_MOVE, add(`${MOVED_ROOT}/lwc/cmp/cmp.css`, LWC_CSS)],
    expected: CMP_DEPLOYED([
      ...CMP_MOVED_PATHS,
      `${MOVED_ROOT}/lwc/cmp/cmp.css`,
    ]),
  },
  {
    title: 'a bundle moved with one file removed is deployed whole',
    base: [PROJECT, ...CMP],
    change: [
      ...movesOf(CMP.slice(0, 2), DEFAULT_ROOT, MOVED_ROOT),
      remove(CMP[2]?.path as string),
    ],
    expected: CMP_DEPLOYED(CMP_MOVED_PATHS.slice(0, 2)),
  },
  {
    title: 'a class moved into another package directory is deployed',
    base: [file(PROJECT_FILE, projectJson(['force-app', 'billing'])), ...FOO],
    change: movesOf(FOO, DEFAULT_ROOT, BILLING_ROOT),
    expected: BILLING_FOO_DEPLOYED,
  },
  {
    title: 'a class moved from outside every package directory is deployed',
    base: [PROJECT, ...classFiles('unpackaged', 'Foo')],
    change: movesOf(
      classFiles('unpackaged', 'Foo'),
      'unpackaged',
      DEFAULT_ROOT
    ),
    expected: {
      pkg: ['ApexClass:Foo'],
      copied: FOO.map(({ path }) => path),
      changes: ['add:ApexClass:Foo'],
    },
  },
  {
    title: 'a class moved to outside every package directory is deployed',
    base: [PROJECT, ...FOO],
    change: movesOf(FOO, DEFAULT_ROOT, 'unpackaged'),
    expected: {
      pkg: ['ApexClass:Foo'],
      copied: FOO.map(({ path }) => path.replace(DEFAULT_ROOT, 'unpackaged')),
      changes: ['add:ApexClass:Foo'],
    },
  },
  {
    title:
      'a class moved with no sfdx-project.json at either revision is neither deployed nor copied',
    base: FOO,
    change: FOO_MOVE,
    expected: {},
  },
  {
    title:
      'a class moved into a directory the project only declares at the target revision is deployed',
    base: [file(PROJECT_FILE, projectJson(['force-app'])), ...FOO],
    change: [
      ...movesOf(FOO, DEFAULT_ROOT, BILLING_ROOT),
      add(PROJECT_FILE, projectJson(['force-app', 'billing'])),
    ],
    expected: BILLING_FOO_DEPLOYED,
  },
  {
    title:
      'a class moved inside the innermost of nested package directories is neither deployed nor copied',
    base: [
      file(PROJECT_FILE, projectJson(['force-app', 'force-app/billing'])),
      ...classFiles('force-app/billing/main/default', 'Foo'),
    ],
    change: movesOf(
      classFiles('force-app/billing/main/default', 'Foo'),
      'force-app/billing/main/default',
      'force-app/billing/other'
    ),
    expected: {},
  },
  {
    title: 'a class moved across nested package directories is deployed',
    base: [
      file(PROJECT_FILE, projectJson(['force-app', 'force-app/billing'])),
      ...FOO,
    ],
    change: movesOf(FOO, DEFAULT_ROOT, 'force-app/billing/main/default'),
    expected: {
      pkg: ['ApexClass:Foo'],
      copied: FOO.map(({ path }) =>
        path.replace(DEFAULT_ROOT, 'force-app/billing/main/default')
      ),
      changes: ['add:ApexClass:Foo'],
    },
  },
  {
    title:
      'a class moved inside a path declared by two package directories is neither deployed nor copied',
    base: [file(PROJECT_FILE, projectJson(['force-app', 'force-app'])), ...FOO],
    change: FOO_MOVE,
    expected: {},
  },
  {
    title:
      'a class moved inside a package directory written with a leading ./ and a trailing / is neither deployed nor copied',
    base: [file(PROJECT_FILE, projectJson(['./force-app/'])), ...FOO],
    change: FOO_MOVE,
    expected: {},
  },
  {
    title:
      'a class moved inside a package directory written with backslashes is neither deployed nor copied',
    base: [file(PROJECT_FILE, projectJson(['force-app\\'])), ...FOO],
    change: FOO_MOVE,
    expected: {},
  },
  {
    title: 'a class moved into a directory the ignore file covers',
    base: [PROJECT, ...FOO],
    change: FOO_MOVE,
    ignore: [`${MOVED_ROOT}/`],
    expected: {},
  },
  {
    title:
      'a class moved while an identical copy is added under a directory the ignore file covers',
    base: [PROJECT, ...FOO],
    change: [
      ...FOO_MOVE,
      add(`${MOVED_ROOT}/classes/sub/Foo.cls`, FOO[0]?.content as string),
    ],
    ignore: [`${MOVED_ROOT}/classes/sub/`],
    expected: {},
  },
  {
    title:
      'a class moved out of a directory the ignore file covers, with no destructive ignore file',
    base: [PROJECT, ...FOO],
    change: FOO_MOVE,
    ignore: ['force-app/main/'],
    expected: FOO_DEPLOYED,
  },
  {
    title:
      'a class moved out of a directory the ignore file covers, with an unrelated destructive ignore file',
    base: [PROJECT, ...FOO],
    change: FOO_MOVE,
    ignore: ['force-app/main/'],
    ignoreDestructive: ['unrelated/'],
    expected: FOO_DEPLOYED,
  },
  {
    title:
      'a class moved out of a directory only the destructive ignore file covers',
    base: [PROJECT, ...FOO],
    change: FOO_MOVE,
    ignoreDestructive: ['force-app/main/'],
    expected: FOO_DEPLOYED,
  },
  {
    title:
      'a class moved into a directory only the destructive ignore file covers',
    base: [PROJECT, ...FOO],
    change: FOO_MOVE,
    ignoreDestructive: [`${MOVED_ROOT}/`],
    expected: {},
  },
]

describe.each(componentCases)(
  'Given $title',
  ({ base, change, expected, ...ignores }) => {
    let refs: ScenarioRefs
    beforeAll(() => {
      refs = build(expected.pkg?.join(',') ?? 'nothing', base, change)
    }, FIXTURE_HOOK_BUDGET_MS)

    it('When sgd runs with and without the changes manifest, Then both manifests and the copied files match the expectation', async () => {
      // Act
      const result = await outcomeOf({
        refs,
        overrides: await ignoreOverrides(ignores),
      })

      // Assert
      expectOutcome(result, expected)
    })
  }
)

describe('Given a class renamed while moving', () => {
  let refs: ScenarioRefs
  beforeAll(() => {
    refs = build(
      'class-renamed',
      [PROJECT, ...FOO],
      FOO.map(({ path }) =>
        move(path, path.replace(DEFAULT_ROOT, MOVED_ROOT).replace('Foo', 'Bar'))
      )
    )
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When the content is identical, Then the new name is deployed and the old name is destructed', async () => {
    // Act
    const result = await outcomeOf({ refs })

    // Assert
    expectOutcome(result, {
      pkg: ['ApexClass:Bar'],
      destructive: ['ApexClass:Foo'],
      copied: FOO_MOVED_PATHS.map(path => path.replace('Foo', 'Bar')),
      changes: ['rename:ApexClass:Foo>Bar'],
    })
  })
})

describe('Given a report moved between folders', () => {
  const REPORT = (folder: string): string =>
    `${DEFAULT_ROOT}/reports/${folder}/R.report-meta.xml`
  let refs: ScenarioRefs
  beforeAll(() => {
    refs = build(
      'report-folder',
      [
        PROJECT,
        file(
          `${DEFAULT_ROOT}/reports/Old.reportFolder-meta.xml`,
          REPORT_FOLDER_META
        ),
        file(REPORT('Old'), REPORT_META),
      ],
      [
        move(REPORT('Old'), REPORT('New')),
        add(
          `${DEFAULT_ROOT}/reports/New.reportFolder-meta.xml`,
          REPORT_FOLDER_META
        ),
      ]
    )
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When the destination folder descriptor is added, Then the report is deployed at its new path and no report is destructed', async () => {
    // Act
    const result = await outcomeOf({ refs })

    // Assert
    expectOutcome(result, {
      pkg: ['Report:New/R', 'ReportFolder:New'],
      copied: [
        `${DEFAULT_ROOT}/reports/New.reportFolder-meta.xml`,
        REPORT('New'),
      ],
      changes: ['add:ReportFolder:New', 'rename:Report:Old/R>New/R'],
    })
  })
})

describe('Given an unusable sfdx-project.json at the target revision', () => {
  let refs: ScenarioRefs
  beforeAll(() => {
    refs = build(
      'project-unusable',
      [PROJECT, ...FOO],
      [...FOO_MOVE, add(PROJECT_FILE, 'not json')]
    )
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When a class moves inside one package directory, Then it is deployed and the skipped check is warned about', async () => {
    // Act
    const result = await outcomeOf({ refs })

    // Assert
    expectOutcome(result, { ...FOO_DEPLOYED, warnings: result.warnings })
    expect(result.warnings).toEqual([
      expect.stringContaining('Could not read the package directories'),
    ])
  })
})
