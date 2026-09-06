'use strict'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { ObjectId } from '@scolladon/tsgit'
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
import { getConcurrencyThreshold } from '../../src/utils/concurrencyUtils'
import { IgnoreHelper } from '../../src/utils/ignoreHelper'
import { MessageService } from '../../src/utils/MessageService'
import RepoGitDiff from '../../src/utils/repoGitDiff'
import { computeTreeIndexScope } from '../../src/utils/treeIndexScope'
import { buildRunTreeReader } from '../../src/utils/treeReaderBuilder'
import {
  buildInFileFanOutFixtureRepo,
  buildLiveContainerFixtureRepo,
  buildUnreadableSubtreeFixtureRepo,
  IN_FILE_FAN_OUT_ADDED_ALERT,
  type InFileFanOutFixtureRefs,
  inFileFanOutWorkflowName,
  LIVE_KEEP_CLASS,
  type LiveContainerFixtureRefs,
  UNREADABLE_SUBTREE_COPY_COUNT,
  UNREADABLE_SUBTREE_PATH,
  type UnreadableSubtreeFixtureRefs,
  unlinkTreeObjectAt,
} from '../__utils__/gitFixtureRepo'
import { createTempDir, runGit, toFileUrl } from '../__utils__/gitTestHarness'
import { sourceDirs } from '../__utils__/sourceDirs'
import { getContext } from '../__utils__/testWork'

const SHALLOW_CLONE_DEPTH = '2'

// GitAdapter.indexRevision is protected; this names just enough of its
// shape to spy on the shared prototype method without an `any` escape.
type IndexRevisionHost = {
  indexRevision: (revision: string) => Promise<ReadonlyMap<string, ObjectId>>
}

// GitAdapter.flattenRevision is protected too. It is the one call that runs
// only on a genuine indexRevision memo miss, so spying it distinguishes
// "the memo answered" from "the tree got walked again", which spying
// indexRevision itself cannot. peelToCommit is no longer that proxy:
// ConfigValidator peels every --from/--to at validation, before any walk.
type FlattenRevisionHost = {
  flattenRevision: (revision: string) => Promise<ReadonlyMap<string, ObjectId>>
}

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
  // ~61 git spawns plus the SDR registry load; the default 10s hook timeout
  // has a documented Windows-runner flake of exactly this shape.
}, 30_000)

afterEach(async () => {
  await GitAdapter.closeAll()
  IgnoreHelper.resetIgnoreInstance()
  IgnoreHelper.resetIncludeInstance()
  // A failing assertion on a spy set up mid-test would otherwise skip its
  // mockRestore() and leak the prototype spy into later tests.
  vi.restoreAllMocks()
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
    // The whole manifest, not just one type's members: a regression that
    // ALSO landed bar/deep/Admin/the page destructively would still pass a
    // members(destructive, 'LightningComponentBundle') check alone.
    expect([...destructive]).toEqual([
      ['LightningComponentBundle', new Set(['gone'])],
    ])

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

describe('Given a --generate-delta-on run over the live-container fixture', () => {
  it("When sgd runs, Then a repeated request for `to` is served from indexRevision's memo instead of re-walking the tree", async () => {
    // Arrange — a --generate-delta-off run never re-asks indexRevision for a
    // revision it already has (buildTreeIndex asks for `to` and `from`
    // once each), so it cannot exercise the memo at all. --generate-delta
    // does: IOExecutor's file copies resolve blob content at `to`
    // (getBufferContentOrEscalate -> resolveObjectId -> indexRevision(to))
    // on top of buildTreeIndex's own call, so indexRevision('to') is asked
    // for more than once. A timing ceiling cannot catch the memo breaking
    // either — one extra flatten costs only a few ms, invisible against
    // bench noise (see pipeline.bench.ts) — so this pins call counts
    // directly: flattenRevision runs only past indexRevision's early-return,
    // so its count divides "answered from the memo" from "walked again".
    const indexRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as IndexRevisionHost,
      'indexRevision'
    )
    const flattenRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as FlattenRevisionHost,
      'flattenRevision'
    )

    // Act
    await runSgd({ generateDelta: true })

    // Assert — more indexRevision calls than distinct revisions means a
    // revision got asked for twice; flattenRevision running exactly once per
    // distinct revision proves that repeat was served from the memo rather
    // than re-walking the tree.
    const revisionsSeen = new Set(
      indexRevisionSpy.mock.calls.map(call => call[0])
    )
    expect(indexRevisionSpy.mock.calls.length).toBeGreaterThan(
      revisionsSeen.size
    )
    expect(flattenRevisionSpy).toHaveBeenCalledTimes(revisionsSeen.size)
  })
})

describe("Given the run's reader built by buildRunTreeReader from the diff-derived scope", () => {
  // This leg calls buildRunTreeReader/DiffLineInterpreter directly, bypassing
  // main.ts entirely — buildRunTreeReader never reads config.generateDelta,
  // so it cannot pin cross-mode parity for the --generate-delta fix itself
  // (Leg A does that). What it does pin: handler classification into
  // package vs. destructive is identical regardless of generateDelta.
  it("When the interpreter classifies the same materialised diff with generateDelta false and true, Then handler classification is identical in both modes and matches Leg A's table", async () => {
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

    // Assert — the exact destructive set (gone from the real diff, still
    // forced by the include-destructive file), and still is not
    // double-classified into package.xml too.
    const pkg = off.work.changes.forPackageManifest()
    const destructive = off.work.changes.forDestructiveManifest()
    expect([...destructive]).toEqual([
      ['LightningComponentBundle', new Set(['gone', 'still'])],
    ])
    expect(members(pkg, 'LightningComponentBundle')).not.toContain('still')
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

    // Isolate the forced deletion as the sole source of `still`: the same
    // range with no include-destructive file must not mention it in either
    // manifest. Without this, moving `still`'s addition from genesis to
    // root would still pass every assertion above — it would enter the
    // genesis..head range as its own addition and get cancelled against
    // the forced deletion, a different mechanism than the mask this fix
    // adds.
    const baseline = await runSgd({ generateDelta: false, from: refs.genesis })
    const baselinePkg = baseline.work.changes.forPackageManifest()
    const baselineDestructive = baseline.work.changes.forDestructiveManifest()
    expect(members(baselinePkg, 'LightningComponentBundle')).not.toContain(
      'still'
    )
    expect(
      members(baselineDestructive, 'LightningComponentBundle')
    ).not.toContain('still')
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

describe('Given a diff whose tree-index scope is empty and whose handlers read content concurrently', () => {
  const FAN_OUT_FILE_COUNT = 12
  let fanOutDir: string
  let fanOut: InFileFanOutFixtureRefs

  beforeAll(async () => {
    fanOutDir = await trackedTempDir('sgd-parity-fan-out-')
    fanOut = buildInFileFanOutFixtureRepo(fanOutDir, FAN_OUT_FILE_COUNT)
    // ~50 git spawns; same Windows hook-timeout flake shape as the top-level
    // beforeAll.
  }, 30_000)

  it.each([false, true])(
    'When sgd runs with generateDelta=%s, Then every handler asks indexRevision for both revisions but each revision is walked exactly once',
    async generateDelta => {
      // Arrange — two preconditions keep this leg from passing vacuously: a
      // 1-slot queue serialises the handlers (no race left to catch), and a
      // non-empty scope would let buildRunTreeReader warm the memo before
      // any handler runs (nothing left to race on).
      expect(getConcurrencyThreshold()).toBeGreaterThan(1)
      const scopeProbe = makeConfig({
        repo: fanOutDir,
        to: fanOut.head,
        from: fanOut.base,
      })
      expect(
        computeTreeIndexScope(await materialize(scopeProbe), metadata).size
      ).toBe(0)
      // The probe pooled an adapter for fanOutDir; the measured run starts
      // cold.
      await GitAdapter.closeAll()
      const indexRevisionSpy = vi.spyOn(
        GitAdapter.prototype as unknown as IndexRevisionHost,
        'indexRevision'
      )
      const flattenRevisionSpy = vi.spyOn(
        GitAdapter.prototype as unknown as FlattenRevisionHost,
        'flattenRevision'
      )

      // Act
      const { work } = await runSgd({
        generateDelta,
        repo: fanOutDir,
        to: fanOut.head,
        from: fanOut.base,
      })

      // Assert — every handler asked for both revisions (the "asked"
      // count), yet each revision was walked once (the traversal count).
      // Exact counts, not bounds: a regression to per-caller walking must
      // not be able to hide behind a loose comparison.
      const revisionsSeen = new Set(
        indexRevisionSpy.mock.calls.map(call => call[0])
      )
      expect(revisionsSeen).toEqual(new Set([fanOut.head, fanOut.base]))
      expect(indexRevisionSpy).toHaveBeenCalledTimes(2 * FAN_OUT_FILE_COUNT)
      expect(flattenRevisionSpy).toHaveBeenCalledTimes(revisionsSeen.size)
      // The run did real work with the content it read: the alert added at
      // head lands as a WorkflowAlert member for every file.
      const addedAlerts = Array.from(
        { length: FAN_OUT_FILE_COUNT },
        (_, offset) =>
          `${inFileFanOutWorkflowName(offset + 1)}.${IN_FILE_FAN_OUT_ADDED_ALERT}`
      ).sort()
      expect(
        members(work.changes.forPackageManifest(), 'WorkflowAlert')
      ).toEqual(addedAlerts)
    }
  )
})

describe('Given --from equal to --to and an include file (non-empty scope)', () => {
  it("When sgd runs, Then buildRunTreeReader's two slots for the one revision share a single walk", async () => {
    // Arrange — the include file makes the scope config.source, so
    // buildRunTreeReader runs and asks buildTreeIndex(head) twice under one
    // Promise.all (config.to and config.from are the same string); the
    // empty diff alone would skip the builder and walk nothing.
    const include = await writePatterns('include-same-revision.txt', [
      LIVE_KEEP_CLASS,
    ])
    const indexRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as IndexRevisionHost,
      'indexRevision'
    )
    const flattenRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as FlattenRevisionHost,
      'flattenRevision'
    )

    // Act
    const { work } = await runSgd({ from: refs.head, to: refs.head, include })

    // Assert
    const headAsked = indexRevisionSpy.mock.calls.filter(
      ([revision]) => revision === refs.head
    )
    const headWalked = flattenRevisionSpy.mock.calls.filter(
      ([revision]) => revision === refs.head
    )
    expect(headAsked).toHaveLength(2)
    expect(headWalked).toHaveLength(1)
    const revisionsSeen = new Set(
      indexRevisionSpy.mock.calls.map(call => call[0])
    )
    expect(flattenRevisionSpy).toHaveBeenCalledTimes(revisionsSeen.size)
    expect(members(work.changes.forPackageManifest(), 'ApexClass')).toEqual([
      'Keep',
    ])
  })
})

describe('Given an unreadable subtree that the diff never opens at either revision', () => {
  let unreadableDir: string
  let unreadable: UnreadableSubtreeFixtureRefs

  beforeAll(async () => {
    unreadableDir = await trackedTempDir('sgd-parity-unreadable-')
    unreadable = buildUnreadableSubtreeFixtureRepo(unreadableDir)
  }, 30_000)

  it('When sgd runs with --generate-delta, Then exactly one TreeIndexUnavailable warning is raised, the builder walks to once and the copy batch retries it once more', async () => {
    // Arrange — with fewer queue slots than copies the copies would run
    // one after another and each retry for itself; the precondition keeps
    // the expected count exact instead of runner-dependent.
    expect(getConcurrencyThreshold()).toBeGreaterThanOrEqual(
      UNREADABLE_SUBTREE_COPY_COUNT
    )
    unlinkTreeObjectAt(unreadableDir, unreadable.head, UNREADABLE_SUBTREE_PATH)
    const indexRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as IndexRevisionHost,
      'indexRevision'
    )
    const flattenRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as FlattenRevisionHost,
      'flattenRevision'
    )

    // Act
    const { work } = await runSgd({
      generateDelta: true,
      repo: unreadableDir,
      to: unreadable.head,
      from: unreadable.base,
    })

    // Assert — one warning, from main.ts's own attempt (buildRunTreeReader),
    // rendered through the real message catalogue.
    const expectedWarning = new MessageService().getMessage(
      'warning.TreeIndexUnavailable',
      [unreadable.head]
    )
    expect(work.warnings.map(warning => warning.message)).toEqual([
      expectedWarning,
    ])
    // The subtree is byte-identical at base and head, so one shared tree
    // oid is unlinked and BOTH walks reject; only `to` is warned about,
    // which is what the single-warning assertion above pins.
    // Attempt-scoped means every attempt walks for itself: the builder's
    // rejected walk was evicted, so the copy batch starts one fresh walk
    // and its second copy joins it. `from` is only ever asked by the
    // builder, hence one attempt.
    const headWalked = flattenRevisionSpy.mock.calls.filter(
      ([revision]) => revision === unreadable.head
    )
    const baseWalked = flattenRevisionSpy.mock.calls.filter(
      ([revision]) => revision === unreadable.base
    )
    expect(headWalked).toHaveLength(2)
    expect(baseWalked).toHaveLength(1)
    const headAsked = indexRevisionSpy.mock.calls.filter(
      ([revision]) => revision === unreadable.head
    )
    expect(headAsked).toHaveLength(1 + UNREADABLE_SUBTREE_COPY_COUNT)
    // The manifest still lists the modified bundle: the degrade degrades,
    // it does not abort.
    expect(
      members(work.changes.forPackageManifest(), 'LightningComponentBundle')
    ).toEqual(['foo'])
  })
})

describe('Given --to is a tree-ish of the fixture head', () => {
  it('When sgd runs, Then it rejects with the released ParameterIsNotCommit sentence before any tree is walked', async () => {
    // Arrange — through the real main.ts, catalogue and object store:
    // validation refuses first, so indexRevision is never even asked.
    const treeish = `${refs.head}^{tree}`
    const indexRevisionSpy = vi.spyOn(
      GitAdapter.prototype as unknown as IndexRevisionHost,
      'indexRevision'
    )
    const input = await makeInput({ to: treeish })

    // Act
    const error = await sgd(input).catch((thrown: unknown) => thrown)

    // Assert
    expect((error as Error).message).toBe(
      new MessageService().getMessage('error.ParameterIsNotCommit', [
        'to',
        treeish,
        'tree',
      ])
    )
    expect(indexRevisionSpy).not.toHaveBeenCalled()
  })
})
