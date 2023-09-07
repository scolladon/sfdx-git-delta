'use strict'

import { Config } from '../types/config'
import { MetadataRepository } from '../types/metadata'
import { Work } from '../types/work'

export default class BaseProcessor {
  work: Work
  config: Config
  metadata: MetadataRepository

  constructor(work: Work, metadata: MetadataRepository) {
    this.work = work
    this.config = work.config
    this.metadata = metadata
  }

  public async process() {
    throw new Error('this class should be derived')
  }
}
