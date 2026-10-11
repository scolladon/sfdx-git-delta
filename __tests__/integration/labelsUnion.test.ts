'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { FIXTURE_HOOK_BUDGET_MS } from '../__utils__/gitFixtureRepo'
import {
  A1,
  add,
  asPairs,
  B1,
  B2,
  CLASS_BODY,
  CLASS_BODY_CHANGED,
  CLASS_META,
  file,
  L1,
  L2,
  type LabelEntry,
  labelMembers,
  labels,
  labelsAdd,
  labelsPath,
  move,
  moveLabels,
  OTHER,
  PROJECT_FILE,
  projectJson,
  remove,
  type ScenarioRefs,
  workflowXml,
} from '../__utils__/pureMoveFixtureRepo'
import {
  type Case,
  expectOutcome,
  NOTHING,
  usePureMoveHarness,
} from '../__utils__/pureMoveHarness'

const PROJECT = file(PROJECT_FILE, projectJson(['force-app']))
const { build, outcomeOf, ignoreOverrides } = usePureMoveHarness('labels-union')

const L1_CHANGED: LabelEntry = ['L1', 'one changed']
const A2: LabelEntry = ['A2', 'a2']
const C1: LabelEntry = ['C1', 'c1']
const D1: LabelEntry = ['D1', 'd1']
const O1: LabelEntry = ['O1', 'o1']

const labelsCases: readonly Case[] = [
  {
    title: 'a labels file moved with identical content',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [moveLabels('a', 'x')],
    expected: {},
  },
  {
    title: 'a labels file moved with one value changed',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [remove(labelsPath('a')), labelsAdd('x', [L1_CHANGED, L2])],
    expected: {
      changes: ['modify:CustomLabel:L1'],
      pkg: labelMembers(['L1']),
      copied: [labelsPath('x')],
      elements: { [labelsPath('x')]: asPairs([L1_CHANGED]) },
    },
  },
  {
    title: 'a labels file moved with one label removed',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [remove(labelsPath('a')), labelsAdd('x', [L1])],
    expected: {
      changes: ['delete:CustomLabel:L2'],
      destructive: labelMembers(['L2']),
    },
  },
  {
    title: 'a labels file moved into another package directory',
    base: [
      file(PROJECT_FILE, projectJson(['force-app', 'billing'])),
      labels('a', [L1, L2]),
    ],
    change: [
      move(labelsPath('a'), 'billing/labels/CustomLabels.labels-meta.xml'),
    ],
    expected: {
      changes: ['add:CustomLabel:L1', 'add:CustomLabel:L2'],
      pkg: labelMembers(['L1', 'L2']),
      copied: ['billing/labels/CustomLabels.labels-meta.xml'],
      elements: {
        'billing/labels/CustomLabels.labels-meta.xml': asPairs([L1, L2]),
      },
    },
  },
  {
    title: 'two labels files moved, one of them losing a label',
    base: [PROJECT, labels('a', [A1, A2]), labels('b', [B1, B2], OTHER)],
    change: [
      moveLabels('a', 'x'),
      remove(labelsPath('b', OTHER)),
      labelsAdd('y', [B1], OTHER),
    ],
    expected: {
      changes: ['delete:CustomLabel:B2'],
      destructive: labelMembers(['B2']),
    },
  },
  {
    title:
      'a labels file deleted while another one with the same name is added',
    base: [PROJECT, labels('a', [A1, A2])],
    change: [remove(labelsPath('a')), labelsAdd('c', [C1])],
    expected: {
      changes: [
        'add:CustomLabel:C1',
        'delete:CustomLabel:A1',
        'delete:CustomLabel:A2',
      ],
      pkg: labelMembers(['C1']),
      destructive: labelMembers(['A1', 'A2']),
      copied: [labelsPath('c')],
      elements: { [labelsPath('c')]: asPairs([C1]) },
    },
  },
  {
    title: 'two labels files merged into one',
    base: [PROJECT, labels('a', [A1]), labels('b', [B1], OTHER)],
    change: [
      remove(labelsPath('a')),
      remove(labelsPath('b', OTHER)),
      labelsAdd('z', [A1, B1]),
    ],
    expected: {},
  },
  {
    title: 'one labels file split into two',
    base: [PROJECT, labels('z', [A1, B1])],
    change: [
      remove(labelsPath('z')),
      labelsAdd('a', [A1]),
      labelsAdd('b', [B1], OTHER),
    ],
    expected: {},
  },
  {
    title: 'a labels file deleted whose label moves into a modified sibling',
    base: [PROJECT, labels('a', [A1, A2]), labels('b', [B1], OTHER)],
    change: [
      remove(labelsPath('a')),
      labelsAdd('b', [B1, A1], OTHER),
      labelsAdd('c', [C1]),
    ],
    expected: {
      changes: ['add:CustomLabel:C1', 'delete:CustomLabel:A2'],
      pkg: labelMembers(['C1']),
      destructive: labelMembers(['A2']),
      copied: [labelsPath('c')],
      elements: { [labelsPath('c')]: asPairs([C1]) },
    },
  },
  {
    title: 'a deleted label that a modified file of another name now holds',
    base: [PROJECT, labels('o', [O1], OTHER), labels('a', [A1])],
    change: [
      labelsAdd('o', [O1, A1], OTHER),
      remove(labelsPath('a')),
      labelsAdd('c', [C1]),
    ],
    expected: {
      changes: ['add:CustomLabel:C1'],
      pkg: labelMembers(['C1']),
      copied: [labelsPath('c')],
      elements: { [labelsPath('c')]: asPairs([C1]) },
    },
  },
  {
    title: 'labels carried over by an added file under the ignore file',
    base: [PROJECT, labels('a', [A1, A2])],
    change: [
      remove(labelsPath('a')),
      labelsAdd('c', [A2]),
      labelsAdd('y', [A1], OTHER),
    ],
    ignore: ['force-app/y/'],
    expected: {},
  },
  {
    title:
      'a file under the destructive ignore file next to a moved labels file',
    base: [PROJECT, labels('a', [A1]), labels('d', [D1], OTHER)],
    change: [
      remove(labelsPath('a')),
      labelsAdd('c', [A1]),
      remove(labelsPath('d', OTHER)),
      labelsAdd('e', [D1], OTHER),
    ],
    ignoreDestructive: ['force-app/d/'],
    expected: {
      changes: ['add:CustomLabel:D1'],
      pkg: labelMembers(['D1']),
      copied: [labelsPath('e', OTHER)],
      elements: { [labelsPath('e', OTHER)]: asPairs([D1]) },
    },
  },
  {
    title: 'a label that reappears as a decomposed label file',
    base: [PROJECT, labels('a', [A1, A2])],
    change: [
      remove(labelsPath('a')),
      labelsAdd('c', [A2]),
      add(
        'force-app/c/labels/A1.label-meta.xml',
        '<CustomLabel xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>A1</fullName><language>en_US</language><protected>false</protected><shortDescription>A1</shortDescription><value>a1</value></CustomLabel>\n'
      ),
    ],
    expected: {
      changes: ['add:CustomLabel:A1'],
      pkg: labelMembers(['A1']),
      copied: ['force-app/c/labels/A1.label-meta.xml'],
    },
  },
  {
    title: 'a labels file moved out of a directory the ignore file covers',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [moveLabels('a', 'x')],
    ignore: ['force-app/a/'],
    ignoreDestructive: ['unrelated/'],
    expected: {
      changes: ['add:CustomLabel:L1', 'add:CustomLabel:L2'],
      pkg: labelMembers(['L1', 'L2']),
      copied: [labelsPath('x')],
      elements: { [labelsPath('x')]: asPairs([L1, L2]) },
    },
  },
  {
    title:
      'a labels file moved out of a directory only the destructive ignore file covers',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [moveLabels('a', 'x')],
    ignoreDestructive: ['force-app/a/'],
    expected: {
      changes: ['add:CustomLabel:L1', 'add:CustomLabel:L2'],
      pkg: labelMembers(['L1', 'L2']),
      copied: [labelsPath('x')],
      elements: { [labelsPath('x')]: asPairs([L1, L2]) },
    },
  },
  {
    title:
      'a labels file moved into a directory only the destructive ignore file covers',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [moveLabels('a', 'x')],
    ignoreDestructive: ['force-app/x/'],
    expected: {},
  },
  {
    title: 'a workflow moved with one element removed',
    base: [
      PROJECT,
      file(
        'force-app/a/workflows/Account.workflow-meta.xml',
        workflowXml(['R1', 'R2'])
      ),
    ],
    change: [
      remove('force-app/a/workflows/Account.workflow-meta.xml'),
      add(
        'force-app/x/workflows/Account.workflow-meta.xml',
        workflowXml(['R1'])
      ),
    ],
    expected: {
      changes: ['delete:WorkflowAlert:Account.R2'],
      destructive: ['WorkflowAlert:Account.R2'],
    },
  },
  {
    title: 'a workflow moved with one element removed and another changed',
    base: [
      PROJECT,
      file(
        'force-app/a/workflows/Account.workflow-meta.xml',
        workflowXml(['R1', 'R2'])
      ),
    ],
    change: [
      remove('force-app/a/workflows/Account.workflow-meta.xml'),
      add(
        'force-app/x/workflows/Account.workflow-meta.xml',
        workflowXml(['R1'], ' changed')
      ),
    ],
    expected: {
      changes: [
        'add:Workflow:Account',
        'delete:WorkflowAlert:Account.R2',
        'modify:WorkflowAlert:Account.R1',
      ],
      pkg: ['Workflow:Account', 'WorkflowAlert:Account.R1'],
      destructive: ['WorkflowAlert:Account.R2'],
      copied: ['force-app/x/workflows/Account.workflow-meta.xml'],
      elements: {
        'force-app/x/workflows/Account.workflow-meta.xml': ['R1=R1 changed'],
      },
    },
  },
  {
    title: 'an unchanged labels file next to an unrelated change',
    base: [
      PROJECT,
      labels('o', [O1], OTHER),
      file('force-app/main/classes/Foo.cls', CLASS_BODY),
      file('force-app/main/classes/Foo.cls-meta.xml', CLASS_META),
    ],
    change: [add('force-app/main/classes/Foo.cls', CLASS_BODY_CHANGED)],
    expected: {
      changes: ['modify:ApexClass:Foo'],
      pkg: ['ApexClass:Foo'],
      copied: [
        'force-app/main/classes/Foo.cls',
        'force-app/main/classes/Foo.cls-meta.xml',
      ],
    },
  },
]

describe.each(labelsCases)(
  'Given $title',
  ({ title, base, change, expected, ...ignores }) => {
    let refs: ScenarioRefs
    beforeAll(() => {
      refs = build(title.slice(0, 40), base, change)
    }, FIXTURE_HOOK_BUDGET_MS)

    it('When sgd runs with and without the changes manifest, Then both manifests and the copied content match the expectation', async () => {
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

describe('Given a malformed labels file at the destination of a move', () => {
  let refs: ScenarioRefs
  beforeAll(() => {
    refs = build(
      'malformed shield',
      [PROJECT, labels('a', [L1, L2])],
      [
        remove(labelsPath('a')),
        add(labelsPath('x'), '<CustomLabels><labels>\n'),
      ]
    )
  }, FIXTURE_HOOK_BUDGET_MS)

  it('When sgd runs, Then it warns and gives the same manifests as without the union', async () => {
    // Act
    const result = await outcomeOf({ refs })

    // Assert
    expect({ ...result, warnings: [] }).toEqual(NOTHING)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain(
      `could not process '${labelsPath('x')}'`
    )
  })
})
