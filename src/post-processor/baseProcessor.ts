'use strict'

import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'
import type { Work } from '../types/work.js'

export default class BaseProcessor {
  protected readonly config: Config

  constructor(
    protected readonly work: Work,
    protected readonly metadata: MetadataRepository
  ) {
    this.config = work.config
  }

  public async process() {
    throw new Error('this class should be derived')
  }
}
