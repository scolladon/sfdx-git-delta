'use strict'
import type { Config } from '../../src/types/config'
import type { Work } from '../../src/types/work'
import ChangeSet from '../../src/utils/changeSet'

export const getConfig = (): Config => ({
  source: ['./'],
  output: 'output',
  generateDelta: true,
  to: '',
  from: '',
  ignore: '',
  ignoreDestructive: '',
  apiVersion: -1,
  repo: '',
  ignoreWhitespace: false,
  include: '',
  includeDestructive: '',
})

export const getWork = (): Work => ({
  changes: new ChangeSet(),
  config: getConfig(),
  warnings: [],
})
