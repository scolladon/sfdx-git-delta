'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { Work } from '../types/work'
import TypeHandlerFactory from './typeHandlerFactory'

export default class DiffLineInterpreter {
  constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly work: Work,
    // eslint-disable-next-line no-unused-vars
    protected readonly metadata: MetadataRepository
  ) {}

  public async process(lines: string[]) {
    const typeHandlerFactory = new TypeHandlerFactory(this.work, this.metadata)
    for (const line of lines) {
      await typeHandlerFactory.getTypeHandler(line).handle()
    }
  }
}
