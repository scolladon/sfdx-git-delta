'use strict'
import { describe, expect, it } from 'vitest'
import {
  FLOW_DEFINITIONS_KEY,
  MASTER_DETAIL_TAG,
} from '../../../../src/constant/metadataConstants'

// gitGrep compiles every pattern via `new RegExp(pattern)` (JS regex, not
// POSIX basic regex — see the fidelity note atop GitAdapter.ts). Every
// literal sgd passes to gitGrep must therefore be free of regex
// metacharacters, so JS-RegExp semantics stay equivalent to a plain
// substring search. This inventory curates the exact literal set sgd
// passes and locks that contract down.
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/

// Both patterns are imported from the same constants the production callers
// use, so the inventory cannot drift from the source. Any NEW gitGrep caller
// must add its pattern constant here.

const CURATED_GIT_GREP_PATTERNS: Array<{ pattern: string; samples: string[] }> =
  [
    {
      pattern: MASTER_DETAIL_TAG,
      samples: [
        '<fields><type>MasterDetail</type></fields>',
        '<fields><type>Lookup</type></fields>',
      ],
    },
    {
      pattern: FLOW_DEFINITIONS_KEY,
      samples: ['{"flowDefinitions":{"MyFlow":"1"}}', '{"otherKey":"value"}'],
    },
  ]

describe('gitGrep pattern inventory', () => {
  it.each(CURATED_GIT_GREP_PATTERNS)(
    'Given the curated pattern $pattern, When checked for regex metacharacters, Then it is metacharacter-free',
    ({ pattern }) => {
      // Act
      const containsMetacharacters = REGEX_METACHARACTERS.test(pattern)

      // Assert
      expect(containsMetacharacters).toBe(false)
    }
  )

  it.each(
    CURATED_GIT_GREP_PATTERNS.flatMap(({ pattern, samples }) =>
      samples.map(sample => ({ pattern, sample }))
    )
  )(
    'Given the curated pattern $pattern, When matched as a JS RegExp against sample $sample, Then it agrees with a plain substring search',
    ({ pattern, sample }) => {
      // Act
      const regexMatch = new RegExp(pattern).test(sample)
      const substringMatch = sample.includes(pattern)

      // Assert
      expect(regexMatch).toBe(substringMatch)
    }
  )
})
