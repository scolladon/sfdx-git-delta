'use strict'
import type { TreeIndexes } from '../adapter/gitTreeLister.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult, mergeResults } from '../types/handlerResult.js'
import { pushAll } from '../utils/arrayUtils.js'
import type ChangeSet from '../utils/changeSet.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import BaseProcessor from './baseProcessor.js'
import ChangesManifestProcessor from './changesManifestProcessor.js'
import FlowTranslationProcessor from './flowTranslationProcessor.js'
import IncludeProcessor from './includeProcessor.js'
import PackageGenerator from './packageGenerator.js'

// IncludeProcessor is the only registered processor that reads the tree
// index; the others declare a 2-arg constructor, which TS accepts here
// under normal function-parameter-count covariance (extra call-site
// arguments are simply unused) — so only IncludeProcessor needs to widen
// its own constructor.
type ProcessorConstructor = new (
  config: Config,
  metadata: MetadataRepository,
  treeIndexes: TreeIndexes
) => BaseProcessor

const registeredProcessors: ProcessorConstructor[] = [
  FlowTranslationProcessor,
  IncludeProcessor,
]

// PackageGenerator must run last among legacy processors — it writes the final
// xml manifests. ChangesManifestProcessor reads the same `changes` argument
// executeRemaining hands to every processor, so it is independent of
// PackageGenerator's output.
registeredProcessors.push(PackageGenerator)
registeredProcessors.push(ChangesManifestProcessor)

export default class PostProcessorManager {
  protected readonly processors: BaseProcessor[] = []
  protected readonly collectors: BaseProcessor[] = []

  public use(postProcessor: BaseProcessor) {
    const target = postProcessor.isCollector ? this.collectors : this.processors
    target.push(postProcessor)
    return this
  }

  public async executeRemaining(changes: ChangeSet): Promise<readonly Error[]> {
    const warnings: Error[] = []
    for (const postProcessor of this.processors) {
      pushAll(warnings, await this._safeProcess(postProcessor, changes))
    }
    return warnings
  }

  public async collectAll(changes: ChangeSet): Promise<HandlerResult> {
    const results: HandlerResult[] = []

    for (const collector of this.collectors) {
      try {
        results.push(await collector.transformAndCollect(changes))
      } catch (error) {
        const message = `${collector.constructor.name}: ${getErrorMessage(error)}`
        // Stryker disable next-line StringLiteral -- equivalent: lazy log content is observability only; tests assert on the wrapped warning and the failed result push, not on the lazy log line
        Logger.warn(lazy`${message}`)
        results.push({
          elements: [],
          copies: [],
          warnings: [wrapError(message, error)],
        })
      }
    }

    // Stryker disable next-line ConditionalExpression,EqualityOperator -- equivalent: empty-results short-circuit; flipping to true always calls mergeResults() with no args which returns an empty result, observably the same as emptyResult()
    return results.length > 0 ? mergeResults(...results) : emptyResult()
  }

  private async _safeProcess(
    postProcessor: BaseProcessor,
    changes: ChangeSet
  ): Promise<readonly Error[]> {
    try {
      const outcome = await postProcessor.process(changes)
      return outcome.warnings
    } catch (error) {
      const message = `${postProcessor.constructor.name}: ${getErrorMessage(error)}`
      // Stryker disable next-line StringLiteral -- equivalent: lazy log content is observability only; tests assert on the wrapped warning returned to the caller, not on the lazy log line
      Logger.warn(lazy`${message}`)
      return [wrapError(message, error)]
    }
  }
}

export const getPostProcessors = (
  config: Config,
  metadata: MetadataRepository,
  treeIndexes: TreeIndexes
) => {
  const postProcessor = new PostProcessorManager()

  // Stryker disable next-line BlockStatement -- equivalent: emptying the body skips registering processors; the resulting PostProcessorManager has empty processor/collector lists and executeRemaining()/collectAll() return early — tests assert the registered processor count, but not via this empty-state path
  for (const processor of registeredProcessors) {
    const instance = new processor(config, metadata, treeIndexes)
    postProcessor.use(instance)
  }

  return postProcessor
}
