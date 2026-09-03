'use strict'
import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import sgd from '../../src/main'
import type { Config } from '../../src/types/config'
import type { HandlerResult } from '../../src/types/handlerResult'
import { ChangeKind, ManifestTarget } from '../../src/types/handlerResult'
import type { Manifest } from '../../src/types/work'
import PackageBuilder from '../../src/utils/packageHelper'

// The manifest seam guard: the ChangeSet placed on the returned Work.changes
// must be the same post-filter value PackageGenerator wrote to disk. It drives
// main() end-to-end with a real
// PostProcessorManager/PackageGenerator/ChangesManifestProcessor/ChangeSet,
// and only stubs the boundaries (git, config validation, line processing,
// I/O) — the same seam every other assembly test in this file stubs.
// It must live in its own file: main.test.ts:111-120 mocks
// postProcessorManager wholesale, which this test needs real.

const {
  mockBuildTreeIndex,
  mockComputeTreeIndexScope,
  mockValidateConfig,
  mockGetLines,
  mockGetRenamePairs,
  mockGetUnmatchedSourceScopes,
  mockGetHeldAdditionProbeFailure,
  mockProcess,
  mockExecute,
  mockCloseAll,
  mockCreateWriteStream,
  mockMkdir,
} = vi.hoisted(() => ({
  mockBuildTreeIndex: vi.fn(),
  mockComputeTreeIndexScope: vi.fn(),
  mockValidateConfig: vi.fn(),
  mockGetLines: vi.fn(),
  mockGetRenamePairs:
    vi.fn<() => Array<{ fromPath: string; toPath: string }>>(),
  mockGetUnmatchedSourceScopes: vi.fn<() => readonly string[]>(),
  mockGetHeldAdditionProbeFailure:
    vi.fn<() => { candidateCount: number } | undefined>(),
  mockProcess: vi.fn<(lines: string[]) => Promise<HandlerResult>>(),
  mockExecute: vi.fn(),
  mockCloseAll: vi.fn(),
  mockCreateWriteStream: vi.fn(),
  mockMkdir: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../src/utils/LoggingService')

vi.mock('../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: vi.fn(() => ({
      buildTreeIndex: mockBuildTreeIndex,
    })),
    closeAll: mockCloseAll,
  },
}))

vi.mock('../../src/utils/treeIndexScope', () => ({
  computeTreeIndexScope: (...args: unknown[]) =>
    mockComputeTreeIndexScope(...args),
}))

vi.mock('../../src/utils/configValidator', async () => {
  const actualModule = await vi.importActual<
    typeof import('../../src/utils/configValidator')
  >('../../src/utils/configValidator')
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        ...actualModule,
        validateConfig: mockValidateConfig,
      }
    }),
  }
})

vi.mock('../../src/utils/repoGitDiff', async () => {
  const actualModule = await vi.importActual<
    typeof import('../../src/utils/repoGitDiff')
  >('../../src/utils/repoGitDiff')
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        ...actualModule,
        getLines: mockGetLines,
        getRenamePairs: mockGetRenamePairs,
        getUnmatchedSourceScopes: mockGetUnmatchedSourceScopes,
        getHeldAdditionProbeFailure: mockGetHeldAdditionProbeFailure,
      }
    }),
  }
})

const mockGetTypeHandler = vi.hoisted(() => vi.fn())
vi.mock('../../src/service/typeHandlerFactory', () => ({
  default: vi.fn().mockImplementation(function () {
    return { getTypeHandler: mockGetTypeHandler }
  }),
}))

vi.mock('../../src/service/diffLineInterpreter', async () => {
  const actualModule = await vi.importActual<
    typeof import('../../src/service/diffLineInterpreter')
  >('../../src/service/diffLineInterpreter')
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        ...actualModule,
        process: mockProcess,
      }
    }),
  }
})

vi.mock('../../src/adapter/ioExecutor', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        execute: mockExecute,
      }
    }),
  }
})

vi.mock('node:fs', async () => {
  const actual: typeof import('node:fs') = await vi.importActual('node:fs')
  return {
    ...actual,
    createWriteStream: mockCreateWriteStream,
    promises: {
      ...actual.promises,
      mkdir: mockMkdir,
    },
  }
})

const asAsyncIterable = (lines: string[]): AsyncIterable<string> => ({
  async *[Symbol.asyncIterator]() {
    for (const line of lines) yield line
  },
})

// dst -> the stream handed to createWriteStream's caller, keyed by stream
// identity so it can be paired against PackageBuilder.buildPackageStream's
// spy call args below — buildPackageStream carries no path of its own, and
// Promise.all over the three write ops makes call order an implementation
// detail.
const pathByStream = new Map<PassThrough, string>()

beforeEach(() => {
  vi.clearAllMocks()
  mockValidateConfig.mockResolvedValue([])
  mockGetLines.mockReturnValue(asAsyncIterable([]) as never)
  mockGetRenamePairs.mockReturnValue([])
  mockGetUnmatchedSourceScopes.mockReturnValue([])
  mockGetHeldAdditionProbeFailure.mockReturnValue(undefined)
  mockComputeTreeIndexScope.mockReturnValue(new Set())
  mockExecute.mockResolvedValue(undefined)
  mockMkdir.mockResolvedValue(undefined)
  pathByStream.clear()

  mockCreateWriteStream.mockImplementation((path: string) => {
    const stream = new PassThrough()
    pathByStream.set(stream, path)
    return stream
  })
})

// PackageGenerator._writeManifest hands the Manifest to
// PackageBuilder.buildPackageStream(manifest, ws) — spy on the prototype
// once (rather than mocking the whole module, and rather than re-spying per
// test which vitest treats as a no-op on an already-spied method) so the
// manifest argument is captured without needing to serialise real XML,
// which this test deliberately does not assert (ChangeSet's read projections
// are unchanged by this refactor, so serialisation is covered elsewhere).
const buildPackageStreamSpy = vi.spyOn(
  PackageBuilder.prototype,
  'buildPackageStream'
)

const manifestByPath = (): Map<string, Manifest> => {
  const byPath = new Map<string, Manifest>()
  for (const call of buildPackageStreamSpy.mock.calls) {
    const [manifest, ws] = call as [Manifest, PassThrough]
    const path = pathByStream.get(ws)
    if (path) byPath.set(path, manifest)
  }
  return byPath
}

describe('main — manifest seam', () => {
  const bundleMember = 'site/Foo'
  const coveredMember = 'site/Foo.sfdc_cms__view/home'
  const survivingMember = 'site/Bar.sfdc_cms__view/home'
  const destructiveBundleMember = 'site/Baz'
  const handlerWarning = new Error('handler warning')

  beforeEach(() => {
    buildPackageStreamSpy.mockResolvedValue(undefined)
    mockProcess.mockResolvedValue({
      elements: [
        {
          target: ManifestTarget.Package,
          type: 'DigitalExperienceBundle',
          member: bundleMember,
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.Package,
          type: 'DigitalExperience',
          member: coveredMember,
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.Package,
          type: 'DigitalExperience',
          member: survivingMember,
          changeKind: ChangeKind.Add,
        },
        {
          target: ManifestTarget.DestructiveChanges,
          type: 'DigitalExperienceBundle',
          member: destructiveBundleMember,
          changeKind: ChangeKind.Delete,
        },
        {
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'Foo',
          changeKind: ChangeKind.Add,
        },
      ],
      copies: [],
      warnings: [handlerWarning],
    })
  })

  it('Given a DigitalExperience member covered by a same-target bundle member, When sgd runs, Then the package.xml manifest drops the covered child and keeps the rest', async () => {
    // Act
    await sgd({ output: 'output' } as Config)

    // Assert — assertion 1: the filter ran
    const byPath = manifestByPath()
    const pkg = byPath.get('output/package/package.xml')!
    expect(pkg.get('DigitalExperience')).toEqual(new Set([survivingMember]))
    expect(pkg.get('DigitalExperienceBundle')).toEqual(new Set([bundleMember]))
    expect(pkg.get('ApexClass')).toEqual(new Set(['Foo']))
  })

  it('Given the manifests PackageGenerator wrote, When sgd returns, Then Work.changes agrees with the same post-filter value (the seam trap)', async () => {
    // Act
    const result = await sgd({ output: 'output' } as Config)

    // Assert — assertion 2: seam agreement
    const byPath = manifestByPath()
    expect(result.changes.forPackageManifest()).toEqual(
      byPath.get('output/package/package.xml')
    )
    expect(result.changes.forDestructiveManifest()).toEqual(
      byPath.get('output/destructiveChanges/destructiveChanges.xml')
    )
  })

  it('Given a rename alongside the element channel, When sgd returns, Then Work.changes still agrees with what was written', async () => {
    // Arrange — the returned ChangeSet is built from two inputs, elements and
    // renames. Exercising only the element channel would leave a regression
    // that folds renames into one side of the seam but not the other
    // invisible, since renames participate in both manifest views.
    mockGetRenamePairs.mockReturnValue([
      { fromPath: 'force-app/Old.cls', toPath: 'force-app/New.cls' },
    ])
    mockGetTypeHandler
      .mockResolvedValueOnce({
        getElementDescriptor: () => ({ type: 'ApexClass', member: 'Old' }),
      })
      .mockResolvedValueOnce({
        getElementDescriptor: () => ({ type: 'ApexClass', member: 'New' }),
      })

    // Act
    const result = await sgd({ output: 'output' } as Config)

    // Assert — the rename reached the written manifests, and both views still
    // agree with what PackageGenerator serialised.
    const byPath = manifestByPath()
    expect(byPath.get('output/package/package.xml')!.get('ApexClass')).toEqual(
      new Set(['Foo', 'New'])
    )
    expect(result.changes.forPackageManifest()).toEqual(
      byPath.get('output/package/package.xml')
    )
    expect(result.changes.forDestructiveManifest()).toEqual(
      byPath.get('output/destructiveChanges/destructiveChanges.xml')
    )
  })

  it('Given a handler warning and a bundle-deletion warning, When sgd runs, Then the bundle-deletion warning is appended after the handler warning', async () => {
    // Act
    const result = await sgd({ output: 'output' } as Config)

    // Assert — assertion 3: warning sequencing
    const handlerIdx = result.warnings.indexOf(handlerWarning)
    const deletionIdx = result.warnings.findIndex(w =>
      w.message.includes(destructiveBundleMember)
    )
    expect(handlerIdx).toBeGreaterThanOrEqual(0)
    expect(deletionIdx).toBeGreaterThan(handlerIdx)
  })
})
