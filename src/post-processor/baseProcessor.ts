'use strict'

import { Config } from '../types/config'
import { MetadataRepository } from '../types/metadata'
import { Work } from '../types/work'

export default class BaseProcessor {
  protected readonly work: Work
  protected readonly config: Config
  protected readonly metadata: MetadataRepository

  constructor(work: Work, metadata: MetadataRepository) {
    this.work = work
    this.config = work.config
    this.metadata = metadata
  }

  public async process() {
    throw new Error('this class should be derived')
  }
}
