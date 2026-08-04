'use strict'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'
import type {
  CopyOperation,
  HandlerResult,
  ManifestElement,
} from '../types/handlerResult.js'
import { pushAll } from '../utils/arrayUtils.js'
import { BoundedQueue } from '../utils/concurrency/index.js'
import { getConcurrencyThreshold } from '../utils/concurrencyUtils.js'
import { getErrorMessage, wrapError } from '../utils/errorUtils.js'
import { log } from '../utils/LoggingDecorator.js'
import { Logger, lazy } from '../utils/LoggingService.js'
import StandardHandler from './standardHandler.js'
import TypeHandlerFactory from './typeHandlerFactory.js'

export default class DiffLineInterpreter {
  constructor(
    protected readonly config: Config,
    protected readonly metadata: MetadataRepository
  ) {}

  @log
  public async process(
    lines: Iterable<string> | AsyncIterable<string>,
    revisions?: { from: string; to: string }
  ): Promise<HandlerResult> {
    const effectiveConfig = revisions
      ? { ...this.config, ...revisions }
      : this.config

    const typeHandlerFactory = new TypeHandlerFactory(
      effectiveConfig,
      this.metadata
    )
    const elements: ManifestElement[] = []
    const copies: CopyOperation[] = []
    const warnings: Error[] = []
    const MAX_PARALLELISM = getConcurrencyThreshold()

    // The fold itself (pushAll) is total by construction — a plain nested
    // for…of that cannot throw. This try/catch instead guards the one
    // remaining way a single handler could abort the whole pass: `collect()`
    // rejecting. `BoundedQueue._fail` treats any worker rejection as fatal,
    // clearing `pending` and rejecting every `drain()` waiter — so a per-file
    // failure must become a warning here, not a rejected worker (ADR 003).
    const processor = new BoundedQueue<StandardHandler>(async handler => {
      try {
        const result = await handler.collect()
        pushAll(elements, result.elements)
        pushAll(copies, result.copies)
        pushAll(warnings, result.warnings)
      } catch (error) {
        const message = `${handler.toString()}: ${getErrorMessage(error)}`
        Logger.warn(lazy`${message}`)
        warnings.push(wrapError(message, error))
      }
    }, MAX_PARALLELISM)

    // `for await…of` iterates both Iterable and AsyncIterable so handlers
    // start executing as soon as the first line lands — no need to
    // materialize the whole diff first.
    for await (const line of lines) {
      const handler = await typeHandlerFactory.getTypeHandler(line)
      processor.push(handler)
    }

    await processor.drain()

    return { elements, copies, warnings }
  }
}
