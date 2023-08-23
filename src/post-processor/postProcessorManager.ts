'use strict'
import BaseProcessor from './baseProcessor'
import PackageGenerator from './packageGenerator'
import FlowTranslationProcessor from './flowTranslationProcessor'
import IncludeProcessor from './includeProcessor'
import { Work } from '../types/work'
import { MetadataRepository } from '../types/metadata'

const processors: Array<typeof BaseProcessor> = [
  FlowTranslationProcessor,
  IncludeProcessor,
]

// It must be done last
processors.push(PackageGenerator)

export default class PostProcessorManager {
  postProcessors: BaseProcessor[]
  work: Work

  constructor(work: Work) {
    this.postProcessors = []
    this.work = work
  }

  use(postProcessor: BaseProcessor) {
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

export const getPostProcessors = (work: Work, metadata: MetadataRepository) => {
  const postProcessor = new PostProcessorManager(work)

  for (const processor of processors) {
    const instance = new processor(work, metadata)
    postProcessor.use(instance)
  }

  return postProcessor
}
