'use strict'
import BaseProcessort from './baseProcessor'
import PackageGenerator from './packageGenerator'
import FlowTranslationProcessor from './flowTranslationProcessor'
import IncludeProcessor from './includeProcessor'

const processors: Array<typeof BaseProcessort> = [
  FlowTranslationProcessor,
  IncludeProcessor,
]

// It must be done last
processors.push(PackageGenerator)

export default class PostProcessorManager {
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

export const getPostProcessors = (work, metadata) => {
  const postProcessor = new PostProcessorManager(work)

  for (const processor of processors) {
    const instance = new processor(work, metadata)
    postProcessor.use(instance)
  }

  return postProcessor
}
