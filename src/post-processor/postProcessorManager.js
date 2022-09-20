'use strict'
const PackageGenerator = require('./packageGenerator')
const FlowTranslationProcessor = require('./flowTranslationProcessor')
const ObjectTranslationProcessor = require('./objectTranslationProcessor')

const processors = [
  FlowTranslationProcessor,
  ObjectTranslationProcessor,
  PackageGenerator,
]

class PostProcessorManager {
  postProcessors
  work

  constructor(work) {
    this.postProcessors = []
    this.work = work
  }

  use(postProcessor) {
    this.postProcessors.push(postProcessor)
    return this
  }

  async execute() {
    for (const postProcessor of this.postProcessors) {
      try {
        await postProcessor.process()
      } catch (error) {
        this.work.warnings.push(error)
      }
    }
  }
}

module.exports = PostProcessorManager

module.exports.getPostProcessors = (work, metadata) => {
  const postProcessor = new PostProcessorManager(work)

  for (const processor of processors) {
    const instance = new processor(work, metadata)
    postProcessor.use(instance)
  }

  return postProcessor
}
