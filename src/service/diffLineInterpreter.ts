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
import { log } from '../utils/LoggingDecorator.js'
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

    // The fold is total by construction: pushAll is a plain nested for…of over
    // arrays, so the worker cannot reject on aggregation. That matters because
    // BoundedQueue treats any worker rejection as fatal — it clears `pending`
    // and rejects every drain() waiter — so an aggregation step that could
    // throw would turn a per-file failure into a whole-run abort. Per-file
    // failures are already contained inside StandardHandler.collect, which
    // returns them as warnings rather than rejecting.
    const processor = new BoundedQueue<StandardHandler>(async handler => {
      const result = await handler.collect()
      pushAll(elements, result.elements)
      pushAll(copies, result.copies)
      pushAll(warnings, result.warnings)
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
