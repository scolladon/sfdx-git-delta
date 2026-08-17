'use strict'
import { EMPTY_TREE_READER } from '../../src/adapter/treeReader'
import type { Config } from '../../src/types/config'
import type { RunContext } from '../../src/types/runContext'
import type { Work } from '../../src/types/work'
import ChangeSet from '../../src/utils/changeSet'
import { sourceDirs } from './sourceDirs'
import { createMetadataRepositoryMock } from './testMetadataRepository'

export const getConfig = (): Config => ({
  source: sourceDirs('./'),
  output: 'output',
  generateDelta: true,
  to: '',
  from: '',
  mergeBase: false,
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

export const getContext = (
  overrides: Partial<RunContext> = {}
): RunContext => ({
  config: getConfig(),
  metadata: createMetadataRepositoryMock(),
  trees: EMPTY_TREE_READER,
  ...overrides,
})
