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

const registeredProcessors: ProcessorConstructor[] = [
  FlowTranslationProcessor,
  IncludeProcessor,
]

// It must be done last
registeredProcessors.push(PackageGenerator)

export default class PostProcessorManager {
  protected readonly processors: BaseProcessor[] = []
  protected readonly collectors: BaseProcessor[] = []

  constructor(protected readonly work: Work) {}

  public use(postProcessor: BaseProcessor) {
    const target = postProcessor.isCollector ? this.collectors : this.processors
    target.push(postProcessor)
    return this
  }

  public async execute() {
    for (const postProcessor of [...this.processors, ...this.collectors]) {
      await this._safeProcess(postProcessor)
    }
  }

  public async executeRemaining() {
    for (const postProcessor of this.processors) {
      await this._safeProcess(postProcessor)
    }
  }

  public async collectAll(): Promise<HandlerResult> {
    const results: HandlerResult[] = []

    for (const collector of this.collectors) {
      try {
        results.push(await collector.transformAndCollect())
      } catch (error) {
        const message = `${collector.constructor.name}: ${getErrorMessage(error)}`
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

  private async _safeProcess(postProcessor: BaseProcessor) {
    try {
      await postProcessor.process()
    } catch (error) {
      const message = `${postProcessor.constructor.name}: ${getErrorMessage(error)}`
      Logger.warn(lazy`${message}`)
      this.work.warnings.push(wrapError(message, error))
    }
  }
}

export const getPostProcessors = (work: Work, metadata: MetadataRepository) => {
  const postProcessor = new PostProcessorManager(work)

  for (const processor of registeredProcessors) {
    const instance = new processor(work, metadata)
    postProcessor.use(instance)
  }

  return postProcessor
}
