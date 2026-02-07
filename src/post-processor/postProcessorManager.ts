'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult, mergeResults } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'

import BaseProcessor from './baseProcessor.js'
import FlowTranslationProcessor from './flowTranslationProcessor.js'
import IncludeProcessor from './includeProcessor.js'
import PackageGenerator from './packageGenerator.js'

type ProcessorConstructor = new (
  work: Work,
  metadata: MetadataRepository
) => BaseProcessor

const processors: ProcessorConstructor[] = [
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
        const message = `${postProcessor.constructor.name}: ${getErrorMessage(error)}`
        Logger.warn(lazy`${message}`)
        this.work.warnings.push(wrapError(message, error))
      }
    }
  }

  public async executeRemaining() {
    for (const postProcessor of this.postProcessors) {
      if (postProcessor instanceof IncludeProcessor) {
        continue
      }
      try {
        await postProcessor.process()
      } catch (error) {
        const message = `${postProcessor.constructor.name}: ${getErrorMessage(error)}`
        Logger.warn(lazy`${message}`)
        this.work.warnings.push(wrapError(message, error))
      }
    }
  }

  public async collectAll(): Promise<HandlerResult> {
    const results: HandlerResult[] = []

    for (const postProcessor of this.postProcessors) {
      try {
        if (postProcessor instanceof IncludeProcessor) {
          results.push(await postProcessor.transformAndCollect())
        }
      } catch (error) {
        const message = `${postProcessor.constructor.name}: ${getErrorMessage(error)}`
        Logger.warn(lazy`${message}`)
        results.push({
          manifests: [],
          copies: [],
          warnings: [wrapError(message, error)],
        })
      }
    }

    return results.length > 0 ? mergeResults(...results) : emptyResult()
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
