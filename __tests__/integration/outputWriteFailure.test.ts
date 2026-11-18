'use strict'
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { OutputWriteError } from '../../src/utils/errorUtils'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import {
  FIXTURE_HOOK_BUDGET_MS,
  type FixtureOp,
  initRepo,
  makeCommit,
} from '../__utils__/gitFixtureRepo.ts'
import {
  createTempDir,
  runGit,
  runGitText,
} from '../__utils__/gitTestHarness.ts'

// Pinning apiVersion keeps the run offline.
const API_VERSION = 60
const TMP_SUFFIX = '.tmp'
const DEFAULT_ROOT = 'force-app/main/default'
const LABELS_PATH = `${DEFAULT_ROOT}/labels/CustomLabels.labels-meta.xml`
const WORKFLOW_PATH = `${DEFAULT_ROOT}/workflows/Account.workflow-meta.xml`
const CLASS_PATH = `${DEFAULT_ROOT}/classes/Foo.cls`
const CLASS_META_PATH = `${DEFAULT_ROOT}/classes/Foo.cls-meta.xml`
const PACKAGE_MANIFEST = 'package/package.xml'
const DESTRUCTIVE_MANIFEST = 'destructiveChanges/destructiveChanges.xml'

const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const labelsXml = (labels: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">\n${labels
    .map(
      name =>
        `  <labels>\n    <fullName>${name}</fullName>\n    <value>${name}</value>\n  </labels>\n`
    )
    .join('')}</CustomLabels>\n`

const workflowXml = (alerts: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">\n${alerts
    .map(name => `  <alerts>\n    <fullName>${name}</fullName>\n  </alerts>\n`)
    .join('')}</Workflow>\n`

const add = (path: string, content: string): FixtureOp => ({
  kind: 'add',
  mode: '100644',
  path,
  content,
})

type Refs = { base: string; head: string }

const buildFixture = (dir: string): Refs => {
  initRepo(dir)
  const base = makeCommit(dir, null, 'base', [
    add(LABELS_PATH, labelsXml(['L1'])),
    add(WORKFLOW_PATH, workflowXml(['A1'])),
  ])
  const head = makeCommit(dir, base, 'head', [
    add(LABELS_PATH, labelsXml(['L1', 'L2'])),
    add(WORKFLOW_PATH, workflowXml(['A1', 'A2'])),
    add(CLASS_PATH, 'public class Foo {}\n'),
    add(CLASS_META_PATH, '<ApexClass/>\n'),
  ])
  runGit(['update-ref', 'HEAD', head], { cwd: dir })
  return { base, head }
}

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false
  )

const listFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
}

describe('Given output obstacles below a valid output directory', () => {
  let dir: string
  let refs: Refs

  beforeAll(async () => {
    dir = await trackedTempDir('sgd-output-write-fixture-')
    refs = buildFixture(dir)
    expect(runGitText(['rev-parse', 'HEAD'], { cwd: dir })).toBe(refs.head)
  }, FIXTURE_HOOK_BUDGET_MS)

  afterEach(async () => {
    await GitAdapter.closeAll()
    IgnoreHelper.resetIgnoreInstance()
    IgnoreHelper.resetIncludeInstance()
  })

  afterAll(async () => {
    await Promise.all(
      tempDirs.map(path => rm(path, { recursive: true, force: true }))
    )
  })

  const input = (output: string, generateDelta: boolean): ConfigInput => ({
    from: refs.base,
    to: refs.head,
    mergeBase: false,
    output,
    source: ['force-app'],
    repo: dir,
    ignoreWhitespace: false,
    generateDelta,
    apiVersion: API_VERSION,
  })

  it('When sgd runs with generateDelta, Then it resolves with one OutputWriteError per obstacle and every other output is written', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-output-write-out-')
    await mkdir(join(output, `${LABELS_PATH}${TMP_SUFFIX}`), {
      recursive: true,
    })
    await mkdir(join(output, DEFAULT_ROOT), { recursive: true })
    await writeFile(join(output, DEFAULT_ROOT, 'workflows'), 'obstacle')
    await mkdir(join(output, CLASS_PATH), { recursive: true })

    // Act
    const work = await sgd(input(output, true))

    // Assert
    const writeErrors = work.warnings.filter(
      (warning): warning is OutputWriteError =>
        warning instanceof OutputWriteError
    )
    expect(writeErrors).toHaveLength(3)
    expect(writeErrors.map(warning => warning.path)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          new RegExp(`${LABELS_PATH.replaceAll('.', '\\.')}\\.tmp$`)
        ),
        expect.stringMatching(/workflows[\\/]Account\.workflow-meta\.xml$/),
        expect.stringMatching(/classes[\\/]Foo\.cls$/),
      ])
    )
    expect(writeErrors.every(w => w.message.includes('Unable to write'))).toBe(
      true
    )
    expect(await exists(join(output, CLASS_META_PATH))).toBe(true)
    expect(await exists(join(output, PACKAGE_MANIFEST))).toBe(true)
    expect(await exists(join(output, DESTRUCTIVE_MANIFEST))).toBe(true)
    const leftovers = (await listFiles(output)).filter(file =>
      file.endsWith(TMP_SUFFIX)
    )
    expect(leftovers).toEqual([])
  })

  it('When a directory sits at the package manifest path, Then sgd resolves with a PackageGenerator warning naming it and the destructive manifest is written', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-output-write-manifest-')
    await mkdir(join(output, PACKAGE_MANIFEST), { recursive: true })

    // Act
    const work = await sgd(input(output, false))

    // Assert
    const manifestWarnings = work.warnings.filter(warning =>
      warning.message.startsWith('PackageGenerator: ')
    )
    expect(manifestWarnings).toHaveLength(1)
    expect(manifestWarnings[0]?.message).toContain('Unable to write')
    const cause = manifestWarnings[0]?.cause
    expect(cause).toBeInstanceOf(OutputWriteError)
    expect((cause as OutputWriteError).path).toMatch(
      /package[\\/]package\.xml$/
    )
    expect(await exists(join(output, DESTRUCTIVE_MANIFEST))).toBe(true)
  })
})
