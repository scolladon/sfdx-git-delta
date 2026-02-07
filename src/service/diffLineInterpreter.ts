'use strict'
import { queue } from 'async'

import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult, mergeResults } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
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
    lines: string[],
    revisions?: { from: string; to: string }
  ): Promise<HandlerResult> {
    const effectiveWork = revisions
      ? { ...this.work, config: { ...this.work.config, ...revisions } }
      : this.work

    const typeHandlerFactory = new TypeHandlerFactory(
      effectiveWork,
      this.metadata
    )
    const results: HandlerResult[] = []
    const MAX_PARALLELISM = getConcurrencyThreshold()

    const processor = queue(async (handler: StandardHandler) => {
      const result = await handler.collect()
      results.push(result)
    }, MAX_PARALLELISM)

    for (const line of lines) {
      const handler = await typeHandlerFactory.getTypeHandler(line)
      processor.push(handler)
    }

    if (processor.length() > 0) {
      await processor.drain()
    }

    return results.length > 0 ? mergeResults(...results) : emptyResult()
  }
}
