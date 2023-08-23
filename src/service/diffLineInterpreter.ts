'use strict'
import { MetadataRepository } from '../types/metadata'
import { Work } from '../types/work'
import TypeHandlerFactory from './typeHandlerFactory'

export default class DiffLineInterpreter {
  work: Work
  metadata: MetadataRepository

  constructor(work: Work, metadata: MetadataRepository) {
    this.work = work
    this.metadata = metadata
  }

  async process(lines: string[]) {
    const typeHandlerFactory = new TypeHandlerFactory(this.work, this.metadata)
    for (const line of lines) {
      await typeHandlerFactory.getTypeHandler(line).handle()
    }
  }
}
