'use strict'
import { availableParallelism } from 'os'

import { queue } from 'async'

import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Work } from '../types/work.js'

import StandardHandler from './standardHandler.js'
import TypeHandlerFactory from './typeHandlerFactory.js'

export default class DiffLineInterpreter {
  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {}

  public async process(lines: string[]) {
    const typeHandlerFactory = new TypeHandlerFactory(this.work, this.metadata)
    const MAX_PARALLELISM = this.getConcurrencyThreshold()
    const processor = queue(
      async (handler: StandardHandler) => await handler.handle(),
      MAX_PARALLELISM
    )

    for (const line of lines) {
      const handler: StandardHandler = typeHandlerFactory.getTypeHandler(line)
      processor.push(handler)
    }

    if (processor.length() > 0) {
      await processor.drain()
    }
  }

  protected getConcurrencyThreshold() {
    // This is because of this issue: https://github.com/scolladon/sfdx-git-delta/issues/762#issuecomment-1907609957
    const AVAILABLE_PARALLELISM = availableParallelism
      ? availableParallelism()
      : Infinity

    return Math.min(AVAILABLE_PARALLELISM, 6)
  }
}
