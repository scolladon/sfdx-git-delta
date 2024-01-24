'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { Work } from '../types/work'
import TypeHandlerFactory from './typeHandlerFactory'
import { availableParallelism } from 'os'
import { queue } from 'async'
import StandardHandler from './standardHandler'

// This is because of this issue: https://github.com/scolladon/sfdx-git-delta/issues/762#issuecomment-1907609957
const AVAILABLE_PARALLELISM = availableParallelism
  ? availableParallelism()
  : Infinity

const MAX_PARALLELISM = Math.min(AVAILABLE_PARALLELISM, 6)

export default class DiffLineInterpreter {
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly work: Work,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {}

  public async process(lines: string[]) {
    const typeHandlerFactory = new TypeHandlerFactory(this.work, this.metadata)
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
}
