'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { Work } from '../types/work'
import TypeHandlerFactory from './typeHandlerFactory'
import { availableParallelism } from 'os'

const MAX_PARALLELISM = Math.min(availableParallelism(), 6)

export default class DiffLineInterpreter {
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly work: Work,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {}

  public async process(lines: string[]) {
    const typeHandlerFactory = new TypeHandlerFactory(this.work, this.metadata)
    const elements = []
    for (const line of lines) {
      const handlingPromise = typeHandlerFactory.getTypeHandler(line).handle()
      elements.push(handlingPromise)
      if (elements.length >= MAX_PARALLELISM) {
        await Promise.race(elements)
        elements.pop()
      }
    }
    if (elements.length > 0) {
      await Promise.all(elements)
    }
  }
}
