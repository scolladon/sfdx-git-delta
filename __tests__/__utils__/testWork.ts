'use strict'
import type { Work } from '../../src/types/work'
import ChangeSet from '../../src/utils/changeSet'

export const getWork = (): Work => ({
  changes: new ChangeSet(),
  config: {
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
  },
  warnings: [],
})
