'use strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import { readManifestXml } from '../__utils__/changesManifestHelpers'
import { FIXTURE_HOOK_BUDGET_MS, initRepo } from '../__utils__/gitFixtureRepo'
import { createTempDir, runGit, runGitText } from '../__utils__/gitTestHarness'

const CLASS_DIR = 'force-app/main/default/classes'
const PROJECT_FILE = 'sfdx-project.json'

const tempDirs: string[] = []
let fixtureDir: string
let fromSha: string
let toSha: string

const projectJson = (sourceApiVersion: string): string =>
  JSON.stringify({
    packageDirectories: [{ path: 'force-app', default: true }],
    sourceApiVersion,
  })

const write = (relative: string, content: string): void => {
  const target = join(fixtureDir, relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

const commitAll = (message: string): string => {
  runGit(['add', '-A'], { cwd: fixtureDir })
  runGit(['commit', '--quiet', '-m', message], { cwd: fixtureDir })
  return runGitText(['rev-parse', 'HEAD'], { cwd: fixtureDir })
}

beforeAll(async () => {
  fixtureDir = await createTempDir('sgd-api-version-fixture-')
  tempDirs.push(fixtureDir)
  initRepo(fixtureDir)
  write(`${CLASS_DIR}/Foo.cls`, 'public class Foo {}\n')
  write(
    `${CLASS_DIR}/Foo.cls-meta.xml`,
    '<?xml version="1.0" encoding="UTF-8"?>\n<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>62.0</apiVersion><status>Active</status></ApexClass>\n'
  )
  write(PROJECT_FILE, projectJson('62.0'))
  fromSha = commitAll('from')
  write(`${CLASS_DIR}/Foo.cls`, 'public class Foo { Integer a; }\n')
  toSha = commitAll('to')
  write(PROJECT_FILE, projectJson('60.0'))
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
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('Given sourceApiVersion committed at --to', () => {
  it('Given 62.0 committed at --to and 60.0 in the working tree, When sgd runs without an api version, Then package.xml carries version 62.0', async () => {
    // Arrange
    const output = await createTempDir('sgd-api-version-out-')
    tempDirs.push(output)

    // Act
    await sgd({
      to: toSha,
      from: fromSha,
      mergeBase: false,
      output,
      source: ['force-app'],
      repo: fixtureDir,
      ignoreWhitespace: false,
      generateDelta: false,
    })
    const { packageXml } = await readManifestXml(output)

    // Assert
    expect(packageXml).toContain('<version>62.0</version>')
  })
})
