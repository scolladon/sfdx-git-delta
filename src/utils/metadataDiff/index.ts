'use strict'
import type { Writable } from 'node:stream'
import GitAdapter from '../../adapter/GitAdapter.js'
import { TAB } from '../../constant/cliConstants.js'
import type { Config } from '../../types/config.js'
import type { SharedFileMetadata } from '../../types/metadata.js'
import type { UnionOutcomes } from '../../types/runContext.js'
import { eachLimit } from '../concurrency/index.js'
import { getConcurrencyThreshold } from '../concurrencyUtils.js'
import { readPathFromGit } from '../fsHelper.js'
import { log } from '../LoggingDecorator.js'
import type { XmlContent } from '../xmlHelper.js'
import { type CompareEntry, StreamingDiff } from './streamingDiff.js'
import {
  parseFromSideSwallowing,
  parseToSidePropagating,
  type RootCapture,
} from './xmlEventReader.js'

export type DiffOutcome = {
  manifests: {
    added: CompareEntry[]
    modified: CompareEntry[]
    deleted: CompareEntry[]
  }
  // True when the to-side has any surviving add or modify, in any bucket.
  // Independent of generateDelta. See StreamingDiff.hasPackageContent for
  // the full contract.
  hasPackageContent: boolean
  writer?: (out: Writable) => Promise<void>
}

export type UnionDiffInput = Readonly<{
  additionBasePaths: readonly string[]
  deletionBasePaths: readonly string[]
  shieldPaths: readonly string[]
  memberPaths: readonly string[]
}>

type RecordedElement = readonly [string, XmlContent]

const entryKey = (entry: CompareEntry): string =>
  `${entry.type}${TAB}${entry.member}`

const replay = (
  engine: StreamingDiff,
  elements: readonly RecordedElement[]
): void => {
  for (const [subType, element] of elements) {
    engine.onFromElement(subType, element)
  }
}

const commonEntries = (
  lists: readonly (readonly CompareEntry[])[]
): CompareEntry[] => {
  const [first = [], ...rest] = lists
  const others = rest.map(list => new Set(list.map(entryKey)))
  return first.filter(entry => others.every(keys => keys.has(entryKey(entry))))
}

/**
 * Streaming metadata diff engine. `run(path)` parses both revisions of
 * the given file via the streaming xmlEventReader, runs the two-pass
 * StreamingDiff engine, and returns manifests + an optional writer
 * closure that emits pruned XML on demand.
 */
export default class MetadataDiff {
  constructor(
    private readonly config: Config,
    private readonly inFileAttributes: Map<string, SharedFileMetadata>
  ) {}

  @log
  async run(path: string): Promise<DiffOutcome> {
    // Ordering mirrors the historical compare() behavior (to first, then
    // from) so tests relying on mockResolvedValueOnce sequencing keep
    // working and so readPathFromGit retries stay consistent under the same
    // GitAdapter queue discipline.
    const toSource = await readPathFromGit(
      { path, oid: this.config.to },
      this.config
    )
    const fromSource = await readPathFromGit(
      { path, oid: this.config.from },
      this.config
    )

    const engine = new StreamingDiff(
      this.inFileAttributes,
      this.config.generateDelta
    )
    await parseFromSideSwallowing(fromSource, engine.onFromElement)
    // Deleted files have an empty to-side; legacy parseXmlFileToJson
    // silently returned {}, so MetadataComparator saw "no children" and
    // emitted every from-side element as deleted. The strict to-side
    // parser throws on empty input, so we short-circuit here: an empty
    // toSource means there are no children to classify, and the engine's
    // drainDeletions pass naturally records every from-side element as
    // deleted. No rootCapture is produced — InFileHandler doesn't need
    // one for a delete-only file and the writer is gated internally.
    const rootCapture: RootCapture | null = toSource
      ? await parseToSidePropagating(toSource, engine.onToElement)
      : null
    const outcome = engine.finalize()
    const writer = engine.buildWriter(rootCapture)
    return {
      manifests: {
        added: outcome.added,
        modified: outcome.modified,
        deleted: outcome.deleted,
      },
      hasPackageContent: outcome.hasPackageContent,
      ...(writer ? { writer } : {}),
    }
  }

  @log
  async runUnion(input: UnionDiffInput): Promise<UnionOutcomes> {
    const recorded = await this._readBase(input.additionBasePaths)
    const deletable = this._deletableKeys(recorded, input.deletionBasePaths)
    const members = new Set(input.memberPaths)
    const outcomes = new Map<string, DiffOutcome>()
    await eachLimit(
      input.shieldPaths,
      getConcurrencyThreshold(),
      async path => {
        outcomes.set(
          path,
          await this._diffShieldFile(path, recorded, members.has(path))
        )
      }
    )
    const deleted = commonEntries(
      [...outcomes.values()].map(outcome => outcome.manifests.deleted)
    ).filter(entry => deletable.has(entryKey(entry)))
    return new Map(
      [...outcomes]
        .filter(([path]) => members.has(path))
        .map(([path, outcome]) => [
          path,
          { ...outcome, manifests: { ...outcome.manifests, deleted } },
        ])
    )
  }

  private async _readBase(
    paths: readonly string[]
  ): Promise<Map<string, RecordedElement[]>> {
    const recorded = new Map<string, RecordedElement[]>()
    const gitAdapter = GitAdapter.getInstance(this.config)
    await eachLimit(paths, getConcurrencyThreshold(), async path => {
      const source = await gitAdapter.getStringContent({
        path,
        oid: this.config.from,
      })
      const elements: RecordedElement[] = []
      await parseFromSideSwallowing(source, (subType, element) => {
        elements.push([subType, element])
      })
      recorded.set(path, elements)
    })
    // Read completion order is nondeterministic; replay order decides which
    // duplicate element wins, so it follows the sorted path order instead.
    return new Map([...recorded].sort(([a], [b]) => (a < b ? -1 : 1)))
  }

  private _deletableKeys(
    recorded: ReadonlyMap<string, readonly RecordedElement[]>,
    deletionPaths: readonly string[]
  ): ReadonlySet<string> {
    const deletionBase = new Set(deletionPaths)
    const engine = new StreamingDiff(this.inFileAttributes, false)
    for (const [path, elements] of recorded) {
      if (deletionBase.has(path)) replay(engine, elements)
    }
    return new Set(engine.finalize().deleted.map(entryKey))
  }

  private async _diffShieldFile(
    path: string,
    recorded: ReadonlyMap<string, readonly RecordedElement[]>,
    emits: boolean
  ): Promise<DiffOutcome> {
    const engine = new StreamingDiff(
      this.inFileAttributes,
      this.config.generateDelta && emits
    )
    for (const elements of recorded.values()) replay(engine, elements)
    const toSource = await GitAdapter.getInstance(this.config).getStringContent(
      { path, oid: this.config.to }
    )
    const rootCapture: RootCapture | null = toSource
      ? await parseToSidePropagating(toSource, engine.onToElement)
      : null
    const outcome = engine.finalize()
    const writer = engine.buildWriter(rootCapture)
    return {
      manifests: {
        added: outcome.added,
        modified: outcome.modified,
        deleted: outcome.deleted,
      },
      hasPackageContent: outcome.hasPackageContent,
      ...(writer ? { writer } : {}),
    }
  }
}
