import { Config } from './Config'
import { Package } from './Package'

type Deploy = {
  package: Package
  destructiveChanges: Package
}

type Result = {
  config: Config
  diffs: Deploy
  warnings: Array<Error>
}

export type { Result, Deploy }
