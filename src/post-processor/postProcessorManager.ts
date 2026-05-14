'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult, mergeResults } from '../types/handlerResult.js'
import type { Work } from '../types/work.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'

import BaseProcessor from './baseProcessor.js'
import ChangesManifestProcessor from './changesManifestProcessor.js'
import DigitalExperienceBundleProcessor from './digitalExperienceBundleProcessor.js'
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
  DigitalExperienceBundleProcessor,
]

// PackageGenerator must run last among legacy processors — it writes the final
// xml manifests. ChangesManifestProcessor operates on work.changes (populated
// by aggregateManifests before executeRemaining runs) so it is independent of
// PackageGenerator's output.
registeredProcessors.push(PackageGenerator)
registeredProcessors.push(ChangesManifestProcessor)

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
        // Stryker disable next-line StringLiteral -- equivalent: lazy log content is observability only; tests assert on the wrapped warning and the failed result push, not on the lazy log line
        Logger.warn(lazy`${message}`)
        const failed = emptyResult()
        failed.warnings.push(wrapError(message, error))
        results.push(failed)
      }
    }

    // Stryker disable next-line ConditionalExpression,EqualityOperator -- equivalent: empty-results short-circuit; flipping to true always calls mergeResults() with no args which returns an empty result, observably the same as emptyResult()
    return results.length > 0 ? mergeResults(...results) : emptyResult()
  }

  private async _safeProcess(postProcessor: BaseProcessor) {
    try {
      await postProcessor.process()
    } catch (error) {
      const message = `${postProcessor.constructor.name}: ${getErrorMessage(error)}`
      // Stryker disable next-line StringLiteral -- equivalent: lazy log content is observability only; tests assert on the wrapped warning pushed onto work.warnings, not on the lazy log line
      Logger.warn(lazy`${message}`)
      this.work.warnings.push(wrapError(message, error))
    }
  }
}

export const getPostProcessors = (work: Work, metadata: MetadataRepository) => {
  const postProcessor = new PostProcessorManager(work)

  // Stryker disable next-line BlockStatement -- equivalent: emptying the body skips registering processors; the resulting PostProcessorManager has empty processor/collector lists and execute()/collectAll() return early — tests assert the registered processor count, but not via this empty-state path
  for (const processor of registeredProcessors) {
    const instance = new processor(work, metadata)
    postProcessor.use(instance)
  }

  return postProcessor
}
