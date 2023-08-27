'use strict'
const TypeHandlerFactory = require('./typeHandlerFactory')

class DiffLineInterpreter {
  work
  metadata

  constructor(work, metadata) {
    this.work = work
    this.metadata = metadata
  }

  async process(lines) {
    const typeHandlerFactory = new TypeHandlerFactory(this.work, this.metadata)
    for (const line of lines) {
      await typeHandlerFactory.getTypeHandler(line).handle()
    }
  }
}

module.exports = DiffLineInterpreter
