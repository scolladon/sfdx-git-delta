'use strict'
const PackageGenerator = require('./packageGenerator')
const FlowTranslationProcessor = require('./flowTranslationProcessor')

const processors = [FlowTranslationProcessor, PackageGenerator]

class PostProcessorManager {
  postProcessors

  constructor() {
    this.postProcessors = []
  }

  use(postProcessor) {
    this.postProcessors.push(postProcessor)
    return this
  }

  async execute() {
    for (const postProcessor of this.postProcessors) {
      await postProcessor.process()
    }
  }
}

module.exports = PostProcessorManager

module.exports.getPostProcessors = (work, config, metadata) => {
  const postProcessor = new PostProcessorManager()

  for (const processor of processors) {
    const instance = new processor(work, config, metadata)
    postProcessor.use(instance)
  }

  return postProcessor
}
