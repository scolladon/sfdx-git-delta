'use strict'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  readManifestXml,
  runBothModes,
} from '../__utils__/changesManifestHelpers'
import {
  FIXTURE_HOOK_BUDGET_MS,
  type FixtureOp,
  initRepo,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'
import {
  add,
  buildScenario,
  CLASS_BODY,
  CLASS_BODY_CHANGED,
  CLASS_META,
  type FixtureFile,
  file,
  labelsXml,
  move,
  PROJECT_FILE,
  projectJson,
  remove,
  type ScenarioRefs,
  workflowXml,
} from '../__utils__/pureMoveFixtureRepo'

// makeInput pins apiVersion, so ConfigValidator's appexchange lookup is never
// reached — this bucket runs behind an unreachable proxy.
const API_VERSION = 60
const PROJECT = file(PROJECT_FILE, projectJson(['force-app']))

let fixtureDir: string
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

type Outcome = {
  pkg: string[]
  destructive: string[]
  copied: string[]
  elements: Record<string, string[]>
  warnings: string[]
}

const NOTHING: Outcome = {
  pkg: [],
  destructive: [],
  copied: [],
  elements: {},
  warnings: [],
}

const membersOf = (xml: string): string[] =>
  [...xml.matchAll(/<types>([\s\S]*?)<\/types>/g)]
    .flatMap(([, body = '']) => {
      const type = /<name>(.*?)<\/name>/.exec(body)?.[1]
      return [...body.matchAll(/<members>(.*?)<\/members>/g)].map(
        ([, member]) => `${type}:${member}`
      )
    })
    .sort()

const copiedFiles = async (output: string): Promise<string[]> => {
  const entries = await readdir(output, {
    recursive: true,
    withFileTypes: true,
  })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(output, join(entry.parentPath, entry.name)))
    .map(path => path.split('\\').join('/'))
    .filter(
      path =>
        !path.startsWith('package/') && !path.startsWith('destructiveChanges/')
    )
    .sort()
}

const ELEMENT =
  /<fullName>(.*?)<\/fullName>[\s\S]*?<(?:value|description)>(.*?)<\/(?:value|description)>/g

const IN_FILE_SUFFIXES = ['.labels-meta.xml', '.workflow-meta.xml']

// The pruned content of every copied container file, as name=value pairs.
const elementsOf = async (
  output: string,
  copied: readonly string[]
): Promise<Record<string, string[]>> => {
  const containers = copied.filter(path =>
    IN_FILE_SUFFIXES.some(suffix => path.endsWith(suffix))
  )
  const entries = await Promise.all(
    containers.map(async path => {
      const content = await readFile(join(output, path), 'utf8')
      const pairs = [...content.matchAll(ELEMENT)].map(
        ([, name, value]) => `${name}=${value}`
      )
      return [path, pairs] as const
    })
  )
  return Object.fromEntries(entries)
}

type Run = { refs: ScenarioRefs; overrides?: Partial<ConfigInput> }

const runSgd = async (run: Run, overrides: Partial<ConfigInput> = {}) => {
  const input: ConfigInput = {
    to: run.refs.to,
    from: run.refs.from,
    mergeBase: false,
    output: await trackedTempDir('sgd-labels-union-out-'),
    source: ['.'],
    repo: fixtureDir,
    ignoreWhitespace: false,
    generateDelta: true,
    apiVersion: API_VERSION,
    ...run.overrides,
    ...overrides,
  }
  const work = await sgd(input)
  const { packageXml, destructiveXml } = await readManifestXml(input.output)
  return { work, packageXml, destructiveXml }
}

// Every scenario runs with and without the changes manifest and must give the
// same package.xml, destructiveChanges.xml and copied file content in both.
const outcomeOf = async (run: Run): Promise<Outcome> => {
  const { off, on } = await runBothModes(
    overrides => runSgd(run, overrides),
    trackedTempDir,
    'sgd-labels-union-manifest-'
  )
  const copied = await copiedFiles(off.work.config.output)
  const elements = await elementsOf(off.work.config.output, copied)
  expect(on.packageXml).toBe(off.packageXml)
  expect(on.destructiveXml).toBe(off.destructiveXml)
  expect(await copiedFiles(on.work.config.output)).toEqual(copied)
  expect(await elementsOf(on.work.config.output, copied)).toEqual(elements)
  return {
    pkg: membersOf(off.packageXml),
    destructive: membersOf(off.destructiveXml),
    copied,
    elements,
    warnings: off.work.warnings.map(warning => warning.message),
  }
}

const ignoreFile = async (lines: readonly string[]): Promise<string> => {
  // _buildIgnore reads with a plain fs.readFile, so the path must be absolute.
  const path = join(
    await trackedTempDir('sgd-labels-union-ignore-'),
    '.sgdignore'
  )
  await writeFile(path, `${lines.join('\n')}\n`)
  return path
}

type Case = {
  title: string
  base: readonly FixtureFile[]
  change: readonly FixtureOp[]
  expected: Partial<Outcome>
  ignore?: readonly string[]
  ignoreDestructive?: readonly string[]
}

const ignoreOverrides = async ({
  ignore,
  ignoreDestructive,
}: Pick<Case, 'ignore' | 'ignoreDestructive'>): Promise<
  Partial<ConfigInput>
> => ({
  ...(ignore ? { ignore: await ignoreFile(ignore) } : {}),
  ...(ignoreDestructive
    ? { ignoreDestructive: await ignoreFile(ignoreDestructive) }
    : {}),
})

const labelsPath = (directory: string, name = 'CustomLabels'): string =>
  `force-app/${directory}/labels/${name}.labels-meta.xml`

const labels = (
  directory: string,
  entries: ReadonlyArray<[string, string]>,
  name = 'CustomLabels'
): FixtureFile => file(labelsPath(directory, name), labelsXml(entries))

const labelsAdd = (
  directory: string,
  entries: ReadonlyArray<[string, string]>,
  name = 'CustomLabels'
): FixtureOp => add(labelsPath(directory, name), labelsXml(entries))

const L1: [string, string] = ['L1', 'one']
const L2: [string, string] = ['L2', 'two']
const L1_CHANGED: [string, string] = ['L1', 'one changed']
const A1: [string, string] = ['A1', 'a1']
const A2: [string, string] = ['A2', 'a2']
const B1: [string, string] = ['B1', 'b1']
const B2: [string, string] = ['B2', 'b2']
const C1: [string, string] = ['C1', 'c1']
const D1: [string, string] = ['D1', 'd1']
const O1: [string, string] = ['O1', 'o1']
const OTHER = 'Other'

const asPairs = (entries: ReadonlyArray<[string, string]>): string[] =>
  entries.map(([name, value]) => `${name}=${value}`)

const labelMembers = (names: readonly string[]): string[] =>
  names.map(name => `CustomLabel:${name}`)

const moveLabels = (from: string, to: string, name = 'CustomLabels') =>
  move(labelsPath(from, name), labelsPath(to, name))

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
      pkg: labelMembers(['L1']),
      copied: [labelsPath('x')],
      elements: { [labelsPath('x')]: asPairs([L1_CHANGED]) },
    },
  },
  {
    title: 'a labels file moved with one label removed',
    base: [PROJECT, labels('a', [L1, L2])],
    change: [remove(labelsPath('a')), labelsAdd('x', [L1])],
    expected: { destructive: labelMembers(['L2']) },
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
    expected: { destructive: labelMembers(['B2']) },
  },
  {
    title:
      'a labels file deleted while another one with the same name is added',
    base: [PROJECT, labels('a', [A1, A2])],
    change: [remove(labelsPath('a')), labelsAdd('c', [C1])],
    expected: {
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
    expected: { destructive: ['WorkflowAlert:Account.R2'] },
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
      pkg: ['ApexClass:Foo'],
      copied: [
        'force-app/main/classes/Foo.cls',
        'force-app/main/classes/Foo.cls-meta.xml',
      ],
    },
  },
]

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-labels-union-fixture-')
  initRepo(fixtureDir)
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
  IgnoreHelper.resetIgnoreInstance()
  IgnoreHelper.resetIncludeInstance()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe.each(labelsCases)(
  'Given $title',
  ({ title, base, change, expected, ...ignores }) => {
    let refs: ScenarioRefs
    beforeAll(() => {
      refs = buildScenario(fixtureDir, title.slice(0, 40), base, change)
    }, FIXTURE_HOOK_BUDGET_MS)

    it('When sgd runs with and without the changes manifest, Then both manifests and the copied content match the expectation', async () => {
      // Act
      const result = await outcomeOf({
        refs,
        overrides: await ignoreOverrides(ignores),
      })

      // Assert
      expect(result).toEqual({ ...NOTHING, ...expected })
    })
  }
)

describe('Given a malformed labels file at the destination of a move', () => {
  it('When sgd runs, Then it warns and gives the same manifests as without the union', async () => {
    // Arrange
    const refs = buildScenario(
      fixtureDir,
      'malformed shield',
      [PROJECT, labels('a', [L1, L2])],
      [
        remove(labelsPath('a')),
        add(labelsPath('x'), '<CustomLabels><labels>\n'),
      ]
    )

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
