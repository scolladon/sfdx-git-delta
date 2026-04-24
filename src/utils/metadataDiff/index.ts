'use strict'
import type { Writable } from 'node:stream'

import type { Config } from '../../types/config.js'
import type { SharedFileMetadata } from '../../types/metadata.js'
import { readPathFromGit } from '../fsHelper.js'
import { log } from '../LoggingDecorator.js'
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
  hasAnyChanges: boolean
  writer?: (out: Writable) => Promise<void>
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
    const rootCapture = await parseToSidePropagating(
      toSource,
      engine.onToElement
    )
    const outcome = engine.finalize()
    const writer = engine.buildWriter(rootCapture)
    return {
      manifests: {
        added: outcome.added,
        modified: outcome.modified,
        deleted: outcome.deleted,
      },
      hasAnyChanges: outcome.hasAnyChanges,
      ...(writer ? { writer } : {}),
    }
  }
}

export type { CompareEntry, RootCapture }
