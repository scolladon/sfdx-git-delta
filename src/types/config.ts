import type { Pathspec } from '../utils/pathspec.js'

export type Config = {
  to: string
  from: string
  mergeBase: boolean
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
// parsed into `Pathspec[]` before a `Config` is constructed.
export type ConfigInput = Omit<Config, 'source'> & { source: string[] }
