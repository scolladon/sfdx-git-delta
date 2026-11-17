import { NO_UNIONS, type RunContext } from '../../../lib/types/runContext.js'
import { createParentDiffMemo } from '../../../lib/utils/metadataDiff/parentDiffMemo.js'

export type BenchContextFields = Pick<
  RunContext,
  'config' | 'metadata' | 'trees'
>

// One builder for every bench run context, so a new RunContext field is added here once.
export const benchContext = (fields: BenchContextFields): RunContext => ({
  ...fields,
  unions: NO_UNIONS,
  parentDiffs: createParentDiffMemo(),
})
