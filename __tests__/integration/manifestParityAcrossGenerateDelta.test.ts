'use strict'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import GitAdapter from '../../src/adapter/GitAdapter'
import sgd from '../../src/main'
import { MetadataRepository } from '../../src/metadata/MetadataRepository'
import { getDefinition } from '../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../src/service/diffLineInterpreter'
import type { Config, ConfigInput } from '../../src/types/config'
import type { Manifest } from '../../src/types/work'
import ChangeSet from '../../src/utils/changeSet'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import RepoGitDiff from '../../src/utils/repoGitDiff'
import { computeTreeIndexScope } from '../../src/utils/treeIndexScope'
import { buildRunTreeReader } from '../../src/utils/treeReaderBuilder'
import {
  buildLiveContainerFixtureRepo,
  LIVE_KEEP_CLASS,
  type LiveContainerFixtureRefs,
} from '../__utils__/gitFixtureRepo'
import { createTempDir, runGit, toFileUrl } from '../__utils__/gitTestHarness'
import { sourceDirs } from '../__utils__/sourceDirs'
import { getContext } from '../__utils__/testWork'

const SHALLOW_CLONE_DEPTH = '2'

// The one seam that leaves the process: ConfigValidator caps apiVersion
// against SDR's live coverage lookup. Pinned so the run is offline and
// deterministic; everything else (git, registry, handlers, writers) is real.
const API_VERSION = 60
vi.mock('../../src/metadata/metadataManager', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../src/metadata/metadataManager')
  >()),
  getLatestSupportedVersion: async () => API_VERSION,
}))

let fixtureDir: string
let refs: LiveContainerFixtureRefs
let patternDir: string
let metadata: MetadataRepository
const tempDirs: string[] = []

const trackedTempDir = async (prefix: string): Promise<string> => {
  const dir = await createTempDir(prefix)
  tempDirs.push(dir)
  return dir
}

const writePatterns = async (
  fileName: string,
  paths: readonly string[]
): Promise<string> => {
  const patternFile = join(patternDir, fileName)
  await writeFile(patternFile, `${paths.join('\n')}\n`)
  return patternFile
}

const makeInput = async (
  overrides: Partial<ConfigInput> = {}
): Promise<ConfigInput> => ({
  to: refs.head,
  from: refs.root,
  mergeBase: false,
  output: await trackedTempDir('sgd-parity-out-'),
  source: ['force-app'],
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  apiVersion: API_VERSION,
  ...overrides,
})

const runSgd = async (
  overrides: Partial<ConfigInput> = {}
): Promise<{
  work: Awaited<ReturnType<typeof sgd>>
  packageXml: string
  destructiveXml: string
}> => {
  const input = await makeInput(overrides)
  const work = await sgd(input)
  const packageXml = await readFile(
    join(input.output, 'package', 'package.xml'),
    'utf8'
  )
  const destructiveXml = await readFile(
    join(input.output, 'destructiveChanges', 'destructiveChanges.xml'),
    'utf8'
  )
  return { work, packageXml, destructiveXml }
}

const members = (manifest: Manifest, type: string): string[] =>
  [...(manifest.get(type) ?? [])].sort()

// Builder-level pipeline (Leg B): mirrors main.ts stage by stage without
// ConfigValidator, so it needs no network stub of its own.
const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  to: refs.head,
  from: refs.root,
  mergeBase: false,
  output: '',
  source: sourceDirs('force-app'),
  repo: fixtureDir,
  ignoreWhitespace: false,
  generateDelta: false,
  ...overrides,
})

const materialize = async (config: Config): Promise<string[]> => {
  const lines: string[] = []
  for await (const line of new RepoGitDiff(config, metadata).getLines()) {
    lines.push(line)
  }
  return lines
}

const runBuilderPipeline = async (
  config: Config
): Promise<{ packageManifest: Manifest; destructiveManifest: Manifest }> => {
  const lines = await materialize(config)
  const scopePaths = [...computeTreeIndexScope(lines, metadata)]
  const { trees } = await buildRunTreeReader(
    GitAdapter.getInstance(config),
    config,
    scopePaths
  )
  const result = await new DiffLineInterpreter(
    getContext({ config, metadata, trees })
  ).process(lines)
  const changes = ChangeSet.from(result.elements)
  return {
    packageManifest: changes.forPackageManifest(),
    destructiveManifest: changes.forDestructiveManifest(),
  }
}

beforeAll(async () => {
  fixtureDir = await trackedTempDir('sgd-parity-fixture-')
  refs = buildLiveContainerFixtureRepo(fixtureDir)
  patternDir = await trackedTempDir('sgd-parity-patterns-')
  // Warms the metadata registry once so no single test pays the SDR load
  // against the 5s default integration timeout.
  metadata = await getDefinition({})
})

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

describe('Given the live-container fixture and no include file', () => {
  it('When sgd runs without and with --generate-delta, Then both runs list foo/bar/deep/Admin/the page in package.xml and only gone in destructiveChanges.xml, and the two manifests are byte-identical', async () => {
    // Act
    const off = await runSgd({ generateDelta: false })
    const on = await runSgd({ generateDelta: true })

    // Assert
    const pkg = off.work.changes.forPackageManifest()
    const destructive = off.work.changes.forDestructiveManifest()
    expect(members(pkg, 'LightningComponentBundle')).toEqual(['foo'])
    expect(members(pkg, 'StaticResource')).toEqual(['bar', 'deep'])
    expect(members(pkg, 'PermissionSet')).toEqual(['Admin'])
    expect(members(pkg, 'DigitalExperience')).toEqual([
      'site/mysite.sfdc_cms__view/about',
    ])
    expect(members(destructive, 'LightningComponentBundle')).toEqual(['gone'])

    expect(off.packageXml).toBe(on.packageXml)
    expect(off.destructiveXml).toBe(on.destructiveXml)
    expect([...off.work.changes.forPackageManifest()]).toEqual([
      ...on.work.changes.forPackageManifest(),
    ])
    expect([...off.work.changes.forDestructiveManifest()]).toEqual([
      ...on.work.changes.forDestructiveManifest(),
    ])
    expect(off.work.warnings).toEqual([])
  })
})

describe("Given the run's reader built by buildRunTreeReader from the diff-derived scope", () => {
  it("When the interpreter processes the materialised diff with generateDelta false and true, Then the package and destructive views are equal and match Leg A's table", async () => {
    // Act
    const off = await runBuilderPipeline(makeConfig({ generateDelta: false }))
    const on = await runBuilderPipeline(makeConfig({ generateDelta: true }))

    // Assert
    expect(members(off.packageManifest, 'LightningComponentBundle')).toEqual([
      'foo',
    ])
    expect(members(off.packageManifest, 'StaticResource')).toEqual([
      'bar',
      'deep',
    ])
    expect(members(off.packageManifest, 'PermissionSet')).toEqual(['Admin'])
    expect(members(off.packageManifest, 'DigitalExperience')).toEqual([
      'site/mysite.sfdc_cms__view/about',
    ])
    expect(
      members(off.destructiveManifest, 'LightningComponentBundle')
    ).toEqual(['gone'])

    expect([...off.packageManifest]).toEqual([...on.packageManifest])
    expect([...off.destructiveManifest]).toEqual([...on.destructiveManifest])
  })
})

describe('Given --include-file naming Keep.cls', () => {
  it('When sgd runs without and with --generate-delta, Then ApexClass/Keep is in package.xml both times and the manifests are byte-identical', async () => {
    // Arrange
    const include = await writePatterns('include.txt', [LIVE_KEEP_CLASS])

    // Act
    const off = await runSgd({ generateDelta: false, include })
    const on = await runSgd({ generateDelta: true, include })

    // Assert
    const pkg = off.work.changes.forPackageManifest()
    expect(members(pkg, 'ApexClass')).toEqual(['Keep'])
    expect(off.packageXml).toBe(on.packageXml)
    expect(off.destructiveXml).toBe(on.destructiveXml)
  })
})

describe('Given --include-destructive-file naming the untouched still bundle and a from that is not the first commit', () => {
  it('When sgd runs without and with --generate-delta, Then LightningComponentBundle/still is in destructiveChanges.xml both times and the manifests are byte-identical', async () => {
    // Arrange — the first commit (genesis) is not config.from here (root
    // is), so the run's tree reader never carries an entry for genesis:
    // the re-entry's liveness check reads empty and reports a true delete.
    const includeDestructive = await writePatterns('include-destructive.txt', [
      'force-app/main/default/lwc/still/**',
    ])

    // Act
    const off = await runSgd({
      generateDelta: false,
      from: refs.root,
      includeDestructive,
    })
    const on = await runSgd({
      generateDelta: true,
      from: refs.root,
      includeDestructive,
    })

    // Assert
    const destructive = off.work.changes.forDestructiveManifest()
    expect(members(destructive, 'LightningComponentBundle')).toContain('still')
    expect(off.packageXml).toBe(on.packageXml)
    expect(off.destructiveXml).toBe(on.destructiveXml)
  })
})

describe('Given --include-destructive-file naming the still bundle and a from that IS the first commit', () => {
  it('When sgd runs without and with --generate-delta, Then the forced deletion lands in destructiveChanges.xml and not in package.xml in both modes, even though the first commit is indexed', async () => {
    // Arrange — config.from IS genesis here, so the run's tree reader
    // carries a real entry for it. Before the fix this made the DELETION
    // pass's liveness check read the bundle as alive and reclassify the
    // forced deletion into package.xml; the mask must force that check to
    // answer false regardless.
    const includeDestructive = await writePatterns(
      'include-destructive-genesis.txt',
      ['force-app/main/default/lwc/still/**']
    )

    // Act
    const off = await runSgd({
      generateDelta: false,
      from: refs.genesis,
      includeDestructive,
    })
    const on = await runSgd({
      generateDelta: true,
      from: refs.genesis,
      includeDestructive,
    })

    // Assert — precondition: `still` is genuinely alive at config.to (never
    // deleted by the fixture), so a correct run can only classify it as a
    // deletion because the include-destructive file forced it, not because
    // the diff itself found it gone.
    const pkg = off.work.changes.forPackageManifest()
    const destructive = off.work.changes.forDestructiveManifest()
    expect(members(pkg, 'LightningComponentBundle')).not.toContain('still')
    expect(members(destructive, 'LightningComponentBundle')).toContain('still')
    expect(off.packageXml).toBe(on.packageXml)
    expect(off.destructiveXml).toBe(on.destructiveXml)
  })
})

describe('Given the live-container fixture cloned shallow so getFirstCommitRef resolves to the graft boundary', () => {
  it('When --include-destructive-file names the still bundle and from is the boundary commit, Then sgd still reports the forced deletion in destructiveChanges.xml, not package.xml, in both modes', async () => {
    // Arrange — a depth-2 clone of the 3-commit fixture grafts `root` as a
    // parentless boundary: getFirstCommitRef() returns `root`, which IS
    // indexed here because it equals config.from — the exact accident
    // `actions/checkout`'s default shallow clone reproduces in CI.
    const shallowDir = await trackedTempDir('sgd-parity-shallow-')
    runGit([
      'clone',
      '--depth',
      SHALLOW_CLONE_DEPTH,
      toFileUrl(fixtureDir),
      shallowDir,
    ])
    const includeDestructive = await writePatterns(
      'include-destructive-shallow.txt',
      ['force-app/main/default/lwc/still/**']
    )

    // Act
    const off = await runSgd({
      generateDelta: false,
      repo: shallowDir,
      from: refs.root,
      to: refs.head,
      includeDestructive,
    })
    const on = await runSgd({
      generateDelta: true,
      repo: shallowDir,
      from: refs.root,
      to: refs.head,
      includeDestructive,
    })

    // Assert — the clone must actually be shallow, or the scenario silently
    // stops exercising `.git/shallow` at all.
    expect(existsSync(join(shallowDir, '.git', 'shallow'))).toBe(true)
    const pkg = off.work.changes.forPackageManifest()
    const destructive = off.work.changes.forDestructiveManifest()
    expect(members(pkg, 'LightningComponentBundle')).not.toContain('still')
    expect(members(destructive, 'LightningComponentBundle')).toContain('still')
    expect(off.packageXml).toBe(on.packageXml)
    expect(off.destructiveXml).toBe(on.destructiveXml)
  })
})
