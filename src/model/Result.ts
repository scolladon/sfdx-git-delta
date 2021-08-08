import { Config } from './Config'
import { Package } from './Package'

type Deploy = {
  package: Package
  destructiveChanges: Package
}

type Result = {
  config: Config
  diffs: Deploy
  warnings: Array<string>
}

export type { Result, Deploy }
