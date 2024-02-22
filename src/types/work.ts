import type { Config } from './config'

export type Manifest = Map<string, Set<string>>

export type Manifests = {
  package: Manifest
  destructiveChanges: Manifest
}

export type Work = {
  config: Config
  diffs: Manifests
  warnings: Error[]
}
