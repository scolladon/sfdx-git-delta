'use strict'
import type { Work } from '../../src/types/work'

export const getWork = (): Work => ({
  diffs: {
    package: new Map<string, Set<string>>(),
    destructiveChanges: new Map<string, Set<string>>(),
  },
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
