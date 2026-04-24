'use strict'
import type { Writable } from 'node:stream'

import type { Config } from '../../types/config.js'
import type { SharedFileMetadata } from '../../types/metadata.js'
import { readPathFromGit } from '../fsHelper.js'
import { log } from '../LoggingDecorator.js'
import type { PrunedContent as LegacyPrunedContent } from './legacy.js'
import LegacyMetadataDiff from './legacy.js'
import { type CompareEntry, StreamingDiff } from './streamingDiff.js'
import {
  parseFromSideSwallowing,
  parseToSidePropagating,
  type RootCapture,
} from './xmlEventReader.js'

export type PrunedContent = LegacyPrunedContent

export type DiffOutcome = {
  manifests: {
    added: CompareEntry[]
    modified: CompareEntry[]
    deleted: CompareEntry[]
  }
  hasAnyChanges: boolean
  writer?: (out: Writable) => Promise<void>
}

/**
 * Collapsed streaming API that replaces the pair of `compare()` +
 * `prune()` calls with a single `run()` returning manifests, an
 * `hasAnyChanges` signal for container-type gating, and an optional
 * writer closure that emits pruned XML when invoked with a Writable.
 *
 * Legacy `compare()` / `prune()` remain on the default export for
 * incremental migration; P4b.2 deletes them.
 */
export default class MetadataDiff extends LegacyMetadataDiff {
  constructor(
    config: Config,
    private readonly inFileAttributes: Map<string, SharedFileMetadata>
  ) {
    super(config, inFileAttributes)
  }

  @log
  async run(path: string): Promise<DiffOutcome> {
    const config = this.getConfig()
    const [fromSource, toSource] = await Promise.all([
      readPathFromGit({ path, oid: config.from }, config),
      readPathFromGit({ path, oid: config.to }, config),
    ])

    const engine = new StreamingDiff(
      this.inFileAttributes,
      config.generateDelta
    )
    await parseFromSideSwallowing(fromSource, engine.onFromElement)
    const rootCapture = await parseToSidePropagating(
      toSource,
      engine.onToElement
    )
    const outcome = engine.finalize()
    return {
      manifests: {
        added: outcome.added,
        modified: outcome.modified,
        deleted: outcome.deleted,
      },
      hasAnyChanges: outcome.hasAnyChanges,
      ...(engine.buildWriter(rootCapture) && {
        writer: engine.buildWriter(rootCapture)!,
      }),
    }
  }

  private getConfig(): Config {
    // Access the private config via protected pattern — legacy class stores
    // it as a private field; we re-expose via a helper here since our
    // subclass needs it for readPathFromGit.
    return (this as unknown as { config: Config }).config
  }
}

// Named re-export retained so callers can `import { type DiffOutcome }` etc.
export type { CompareEntry, RootCapture }
