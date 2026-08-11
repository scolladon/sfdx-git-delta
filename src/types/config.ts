import type { Pathspec } from '../utils/pathspec.js'

export type Config = {
  to: string
  from: string
  /**
   * Resolve `from` as the merge base of `to` and this ref instead of an
   * explicit `from`. Set by --merge-base; consumed and cleared by
   * ConfigValidator before the rest of the pipeline runs.
   */
  mergeBase?: string | undefined
  output: string
  source: Pathspec[]
  ignore?: string | undefined
  ignoreDestructive?: string | undefined
  apiVersion?: number | undefined
  repo: string
  ignoreWhitespace: boolean
  generateDelta: boolean
  include?: string | undefined
  includeDestructive?: string | undefined
  additionalMetadataRegistryPath?: string | undefined
  changesManifest?: string | undefined
}

// The raw, pre-canonicalisation shape accepted at the programmatic entry
// point (src/main.ts's default export): `source` is user-typed strings,
// parsed into `Pathspec[]` before a `Config` is constructed. `from` is
// optional here — it's required unless `mergeBase` is set, which main.ts
// resolves down to a concrete `from` before validation.
export type ConfigInput = Omit<Config, 'source' | 'from'> & {
  source: string[]
  from?: string | undefined
}
