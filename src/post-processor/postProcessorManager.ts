'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository'
import type { Work } from '../types/work'

import BaseProcessor from './baseProcessor'
import FlowTranslationProcessor from './flowTranslationProcessor'
import IncludeProcessor from './includeProcessor'
import PackageGenerator from './packageGenerator'

const processors: Array<typeof BaseProcessor> = [
  FlowTranslationProcessor,
  IncludeProcessor,
]

// It must be done last
processors.push(PackageGenerator)

export default class PostProcessorManager {
  protected readonly postProcessors: BaseProcessor[]

  constructor(protected readonly work: Work) {
    this.postProcessors = []
  }

  public use(postProcessor: BaseProcessor) {
    this.postProcessors.push(postProcessor)
    return this
  }

  public async execute() {
    for (const postProcessor of this.postProcessors) {
      try {
        await postProcessor.process()
      } catch (error) {
        if (error instanceof Error) {
          this.work.warnings.push(error)
        }
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
