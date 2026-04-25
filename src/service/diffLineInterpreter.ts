'use strict'
import { queue } from 'async'

import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { pushAll } from '../utils/arrayUtils.js'
import ChangeSet from '../utils/changeSet.js'
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import StandardHandler from './standardHandler.js'
import TypeHandlerFactory from './typeHandlerFactory.js'

export default class DiffLineInterpreter {
  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {}

  @log
  public async process(
    lines: Iterable<string> | AsyncIterable<string>,
    revisions?: { from: string; to: string }
  ): Promise<HandlerResult> {
    const effectiveWork = revisions
      ? { ...this.work, config: { ...this.work.config, ...revisions } }
      : this.work

    const typeHandlerFactory = new TypeHandlerFactory(
      effectiveWork,
      this.metadata
    )
    // Single ChangeSet shared by every handler in this pass — eliminates the
    // per-handler ChangeSet allocation and the merge step that used to fold
    // ~N small ChangeSets together at the end.
    const sink = new ChangeSet()
    const copies: CopyOperation[] = []
    const warnings: Error[] = []
    const MAX_PARALLELISM = getConcurrencyThreshold()

    const processor = queue(async (handler: StandardHandler) => {
      const result = await handler.collect(sink)
      pushAll(copies, result.copies)
      pushAll(warnings, result.warnings)
    }, MAX_PARALLELISM)

    // `for await…of` iterates both Iterable and AsyncIterable so handlers
    // start executing as soon as the first line lands — no need to
    // materialize the whole diff first.
    for await (const line of lines) {
      const handler = await typeHandlerFactory.getTypeHandler(line)
      processor.push(handler)
    }

    if (!processor.idle()) {
      await processor.drain()
    }

    return { changes: sink, copies, warnings }
  }
}
