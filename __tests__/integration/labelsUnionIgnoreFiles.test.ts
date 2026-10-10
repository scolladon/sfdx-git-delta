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
  type FixtureFile,
  file,
  labelsXml,
  move,
  PROJECT_FILE,
  projectJson,
  remove,
  type ScenarioRefs,
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
    output: await trackedTempDir('sgd-labels-union-ignore-out-'),
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
    'sgd-labels-union-ignore-manifest-'
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
    await trackedTempDir('sgd-labels-union-ignore-ignore-'),
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
const A1: [string, string] = ['A1', 'a1']
const B1: [string, string] = ['B1', 'b1']
const B2: [string, string] = ['B2', 'b2']
const B3: [string, string] = ['B3', 'b3']
const X1: [string, string] = ['X', 'x']
const OTHER = 'Other'

const asPairs = (entries: ReadonlyArray<[string, string]>): string[] =>
  entries.map(([name, value]) => `${name}=${value}`)

const labelMembers = (names: readonly string[]): string[] =>
  names.map(name => `CustomLabel:${name}`)

const moveLabels = (from: string, to: string, name = 'CustomLabels') =>
  move(labelsPath(from, name), labelsPath(to, name))

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
      pkg: labelMembers(['L1', 'L2']),
      copied: [labelsPath('x')],
      elements: { [labelsPath('x')]: asPairs([L1, L2]) },
    },
  },
  {
    title: 'two labels files moved, one of them losing a label, no ignore file',
    base: [PROJECT, labels('a', [A1]), labels('b', [B1, B2], OTHER)],
    change: [
      moveLabels('a', 'x'),
      remove(labelsPath('b', OTHER)),
      labelsAdd('y', [B1], OTHER),
    ],
    expected: { destructive: labelMembers(['B2']) },
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
