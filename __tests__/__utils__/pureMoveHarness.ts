'use strict'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import { afterAll, afterEach, beforeAll, expect } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { ChangeKind } from '../../src/types/handlerResult'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  type ChangesManifestJson,
  readManifestXml,
  runBothModes,
} from './changesManifestHelpers.ts'
import {
  FIXTURE_HOOK_BUDGET_MS,
  type FixtureOp,
  initRepo,
} from './gitFixtureRepo.ts'
import { createTempDir } from './gitTestHarness.ts'
import {
  buildScenario,
  type FixtureFile,
  type ScenarioRefs,
} from './pureMoveFixtureRepo.ts'

// makeInput pins apiVersion, so ConfigValidator's appexchange lookup is never
// reached — this bucket runs behind an unreachable proxy.
const API_VERSION = 60

export type Outcome = {
  pkg: string[]
  destructive: string[]
  copied: string[]
  elements: Record<string, string[]>
  changes: string[]
  warnings: string[]
}

export const NOTHING: Outcome = {
  pkg: [],
  destructive: [],
  copied: [],
  elements: {},
  changes: [],
  warnings: [],
}

export type Case = {
  title: string
  base: readonly FixtureFile[]
  change: readonly FixtureOp[]
  expected: Partial<Outcome>
  ignore?: readonly string[]
  ignoreDestructive?: readonly string[]
}

export type Run = { refs: ScenarioRefs; overrides?: Partial<ConfigInput> }

export type PureMoveHarness = Readonly<{
  build: (
    name: string,
    base: readonly FixtureFile[],
    change: readonly FixtureOp[]
  ) => ScenarioRefs
  outcomeOf: (run: Run) => Promise<Outcome>
  ignoreOverrides: (
    ignores: Pick<Case, 'ignore' | 'ignoreDestructive'>
  ) => Promise<Partial<ConfigInput>>
}>

export const expectOutcome = (
  result: Outcome,
  expected: Partial<Outcome>
): void => {
  expect(result).toEqual({ ...NOTHING, ...expected })
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

const NAME_LIST_KINDS = [
  ChangeKind.Add,
  ChangeKind.Modify,
  ChangeKind.Delete,
] as const

const flattenChanges = (payload: ChangesManifestJson): string[] =>
  NAME_LIST_KINDS.flatMap(kind =>
    Object.entries(payload[kind]).flatMap(([type, names]) =>
      names.map(name => `${kind}:${type}:${name}`)
    )
  )
    .concat(
      Object.entries(payload[ChangeKind.Rename]).flatMap(([type, pairs]) =>
        pairs.map(pair => `rename:${type}:${pair.from}>${pair.to}`)
      )
    )
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

// Registers the fixture repo lifecycle hooks of the calling suite.
export const usePureMoveHarness = (label: string): PureMoveHarness => {
  let fixtureDir = ''
  const tempDirs: string[] = []

  const trackedTempDir = async (prefix: string): Promise<string> => {
    const dir = await createTempDir(prefix)
    tempDirs.push(dir)
    return dir
  }

  beforeAll(async () => {
    fixtureDir = await trackedTempDir(`sgd-${label}-fixture-`)
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

  const runSgd = async (run: Run, overrides: Partial<ConfigInput> = {}) => {
    const input: ConfigInput = {
      to: run.refs.to,
      from: run.refs.from,
      mergeBase: false,
      output: await trackedTempDir(`sgd-${label}-out-`),
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

  // Every scenario runs with and without the changes manifest and must give
  // the same package.xml, destructiveChanges.xml and copied content in both.
  const outcomeOf = async (run: Run): Promise<Outcome> => {
    const { off, on, payload } = await runBothModes(
      overrides => runSgd(run, overrides),
      trackedTempDir,
      `sgd-${label}-manifest-`
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
      changes: flattenChanges(payload),
      warnings: off.work.warnings.map(warning => warning.message),
    }
  }

  const ignoreFile = async (lines: readonly string[]): Promise<string> => {
    // _buildIgnore reads with a plain fs.readFile, so the path must be absolute.
    const path = join(
      await trackedTempDir(`sgd-${label}-ignore-`),
      '.sgdignore'
    )
    await writeFile(path, `${lines.join('\n')}\n`)
    return path
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

  const build: PureMoveHarness['build'] = (name, base, change) =>
    buildScenario(fixtureDir, name, base, change)

  return { build, outcomeOf, ignoreOverrides }
}
