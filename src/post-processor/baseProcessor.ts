'use strict'
export default class BaseProcessor {
  work
  config
  metadata

  constructor(work, metadata) {
    this.work = work
    this.config = work.config
    this.metadata = metadata
  }

  async process() {
    throw new Error('this class should be derived')
  }
}
