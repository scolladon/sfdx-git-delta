'use strict'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import {
  FIXTURE_HOOK_BUDGET_MS,
  initRepo,
  makeCommit,
} from '../__utils__/gitFixtureRepo'
import { createTempDir } from '../__utils__/gitTestHarness'

// Pinning apiVersion keeps ConfigValidator away from the appexchange lookup —
// this bucket runs behind an unreachable proxy (vitest.integration.config.ts).
const API_VERSION = 60
const FLOW_NAME = 'MyFlow'
const FLOW_PATH = `force-app/main/default/flows/${FLOW_NAME}.flow-meta.xml`
const TRANSLATION_PATH =
  'force-app/main/default/translations/fr.translation-meta.xml'
const CHANGED_LABEL = 'ChangedLabel'
const UNCHANGED_LABEL = 'UnchangedLabel'

const flowXml = (label: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>${label}</label>
    <status>Active</status>
</Flow>
`

const translationXml = (changedLabelValue: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<Translations xmlns="http://soap.sforce.com/2006/04/metadata">
    <customLabels>
        <label>${changedLabelValue}</label>
        <name>${CHANGED_LABEL}</name>
    </customLabels>
    <customLabels>
        <label>Unchanged</label>
        <name>${UNCHANGED_LABEL}</name>
    </customLabels>
    <flowDefinitions>
        <flows>
            <screens>
                <label>Screen</label>
                <name>Screen1</name>
            </screens>
        </flows>
        <fullName>${FLOW_NAME}</fullName>
    </flowDefinitions>
</Translations>
`

const addFile = (path: string, content: string) =>
  ({ kind: 'add', mode: '100644', path, content }) as const

let fixtureDir: string
let from: string
let to: string
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-flow-translation-collision-')
  initRepo(fixtureDir)
  from = makeCommit(fixtureDir, null, 'flow and its translation', [
    addFile(FLOW_PATH, flowXml('V1')),
    addFile(TRANSLATION_PATH, translationXml('Before')),
  ])
  to = makeCommit(fixtureDir, from, 'change the flow and one label', [
    addFile(FLOW_PATH, flowXml('V2')),
    addFile(TRANSLATION_PATH, translationXml('After')),
  ])
}, FIXTURE_HOOK_BUDGET_MS)

afterEach(async () => {
  await GitAdapter.closeAll()
})

afterAll(async () => {
  await Promise.all(
    tempDirs.map(dir => rm(dir, { recursive: true, force: true }))
  )
})

describe('Given a commit changing a Flow and a label of a locale translation that also translates that Flow', () => {
  it('When generating the delta, Then the locale file keeps the changed label and gains the packaged Flow translation', async () => {
    // Arrange
    const output = await trackedTempDir('sgd-flow-translation-collision-out-')

    // Act
    await sgd({
      from,
      to,
      mergeBase: false,
      output,
      source: ['force-app'],
      repo: fixtureDir,
      ignoreWhitespace: false,
      generateDelta: true,
      apiVersion: API_VERSION,
    })

    // Assert
    const sut = await readFile(join(output, TRANSLATION_PATH), 'utf8')
    expect(sut).toContain(`<name>${CHANGED_LABEL}</name>`)
    expect(sut).toContain(`<fullName>${FLOW_NAME}</fullName>`)
    expect(sut).not.toContain(`<name>${UNCHANGED_LABEL}</name>`)
  })
})
