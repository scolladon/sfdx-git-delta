'use strict'
class BaseProcessor {
  work
  config
  metadata

  constructor(work, config, metadata) {
    this.work = work
    this.config = config
    this.metadata = metadata
  }

  async process() {
    throw new Error('this class should be derived')
  }
}

module.exports = BaseProcessor
