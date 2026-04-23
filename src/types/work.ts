import type ChangeSet from '../utils/changeSet.js'
import type { Config } from './config.js'

export type Manifest = Map<string, Set<string>>

export type Work = {
  config: Config
  changes: ChangeSet
  warnings: Error[]
}
