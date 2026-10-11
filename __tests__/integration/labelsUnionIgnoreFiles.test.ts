'use strict'
import { beforeAll, describe, it } from 'vitest'
import { FIXTURE_HOOK_BUDGET_MS } from '../__utils__/gitFixtureRepo'
import {
  A1,
  add,
  asPairs,
  B1,
  B2,
  file,
  L1,
  L2,
  type LabelEntry,
  labelMembers,
  labels,
  labelsAdd,
  labelsPath,
  moveLabels,
  OTHER,
  PROJECT_FILE,
  projectJson,
  remove,
  type ScenarioRefs,
} from '../__utils__/pureMoveFixtureRepo'
import {
  type Case,
  expectOutcome,
  usePureMoveHarness,
} from '../__utils__/pureMoveHarness'

const PROJECT = file(PROJECT_FILE, projectJson(['force-app']))
const { build, outcomeOf, ignoreOverrides } = usePureMoveHarness(
  'labels-union-ignore'
)

const B3: LabelEntry = ['B3', 'b3']
const X1: LabelEntry = ['X', 'x']

const BILLING = 'billing'

const labelsCases: readonly Case[] = [
  {
    title:
      'an unmoved labels file under the destructive ignore file losing a label',
    base: [PROJECT, labels('a', [A1]), labels('b', [B1, B2], OTHER)],
    change: [
      remove(labelsPath('a')),
      labelsAdd('c', [A1]),
      labelsAdd('b', [B1], OTHER),
    ],
    ignoreDestructive: ['force-app/b/'],
    expected: {},
  },
  {
    title:
      'a label in a modified file under the destructive ignore file and in a deleted file',
    base: [PROJECT, labels('a', [A1, X1]), labels('b', [B1, X1], OTHER)],
    change: [
      remove(labelsPath('a')),
      labelsAdd('c', [A1]),
      labelsAdd('b', [B1, B3], OTHER),
    ],
    ignoreDestructive: ['force-app/b/'],
    expected: {
      changes: ['add:CustomLabel:B3', 'delete:CustomLabel:X'],
      pkg: labelMembers(['B3']),
      destructive: labelMembers(['X']),
      copied: [labelsPath('b', OTHER)],
      elements: { [labelsPath('b', OTHER)]: asPairs([B3]) },
    },
  },
  {
    title:
      'a label kept by a modified file under the destructive ignore file and in a deleted file',
    base: [PROJECT, labels('a', [A1, X1]), labels('b', [B1, X1], OTHER)],
    change: [
      remove(labelsPath('a')),
      labelsAdd('c', [A1]),
      labelsAdd('b', [B1, X1, B3], OTHER),
    ],
    ignoreDestructive: ['force-app/b/'],
    expected: {
      changes: ['add:CustomLabel:B3'],
      pkg: labelMembers(['B3']),
      copied: [labelsPath('b', OTHER)],
      elements: { [labelsPath('b', OTHER)]: asPairs([B3]) },
    },
  },
  {
    title:
      'an unchanged labels file under the destructive ignore file next to a deleted and an added file',
    base: [PROJECT, labels('b', [B1], OTHER), labels('a', [A1])],
    change: [remove(labelsPath('a')), labelsAdd('c', [A1, B1])],
    ignoreDestructive: ['force-app/b/'],
    expected: {},
  },
  {
    title:
      'an unmoved labels file whose package directory changes next to a moved one',
    base: [PROJECT, labels(BILLING, [B1]), labels('a', [A1])],
    change: [
      add(PROJECT_FILE, projectJson(['force-app', `force-app/${BILLING}`])),
      moveLabels('a', 'x'),
    ],
    expected: {},
  },
  {
    title: 'a labels file moved out of a directory under both ignore files',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [moveLabels('a', 'x')],
    ignore: ['force-app/a/'],
    ignoreDestructive: ['force-app/a/'],
    expected: {
      changes: ['add:CustomLabel:L1', 'add:CustomLabel:L2'],
      pkg: labelMembers(['L1', 'L2']),
      copied: [labelsPath('x')],
      elements: { [labelsPath('x')]: asPairs([L1, L2]) },
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
