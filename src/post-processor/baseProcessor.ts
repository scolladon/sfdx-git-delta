'use strict'

import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Config } from '../types/config.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { emptyResult } from '../types/handlerResult.js'
import type ChangeSet from '../utils/changeSet.js'

export type ProcessorOutcome = Readonly<{ warnings: readonly Error[] }>
export const emptyOutcome = (): ProcessorOutcome => ({ warnings: [] })

export default abstract class BaseProcessor {
  constructor(
    protected readonly config: Config,
    protected readonly metadata: MetadataRepository
  ) {}

  get isCollector(): boolean {
    return false
  }

  public abstract process(changes: ChangeSet): Promise<ProcessorOutcome>

  public async transformAndCollect(
    _changes: ChangeSet
  ): Promise<HandlerResult> {
    return emptyResult()
  }
}
