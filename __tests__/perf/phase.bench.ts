import { describe } from 'vitest'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import {
  createDistinctRoundLines,
  createSameContentLines,
  type FixtureSize,
} from './fixtures/generateFixtures.js'
import { perfBench } from './harness/perfBench.js'

// Replaces a bench that hid three regressions behind a warm instance: one
// MetadataRepository built at module load and reused across every sample
// (the pathCache is warm after the first sample, so the miss path is never
// measured), paths pre-stripped of their diff-status prefix (asFilePath is
// never exercised), and the same string objects reused on every iteration
// (V8's cached string hash means the Map lookup never hashes a string it
// has not seen before). This file rebuilds both halves of that blindness
// per iteration: cold benches build a fresh registry in `beforeEach`, and
// every bench renders a fresh set of lines carrying their diff-status
// prefix, so a miss-path or line-shape regression has somewhere to show up.

describe('phase-metadata-loading', () => {
  perfBench('metadata-registry-load', async () => {
    await getDefinition({})
  })
})

const warmSizes: readonly FixtureSize[] = ['small', 'medium', 'large']

describe('phase-metadata-lookup-cold', () => {
  const nextLines = createDistinctRoundLines('large')
  let metadata: MetadataRepository
  let lines: readonly string[]

  perfBench(
    'metadata-lookup-cold-large',
    () => {
      for (const line of lines) {
        metadata.get(line)
      }
    },
    {
      // Registry AND lines are rebuilt here, outside the timed window: a
      // cold sample must pay only for the lookup loop, never for the setup
      // that makes it cold.
      beforeEach: async () => {
        metadata = await getDefinition({})
        lines = nextLines()
      },
    }
  )
})

describe('phase-fqn-resolution-cold', () => {
  const nextLines = createDistinctRoundLines('large')
  let metadata: MetadataRepository
  let lines: readonly string[]

  perfBench(
    'fqn-resolution-cold-large',
    () => {
      for (const line of lines) {
        metadata.getFullyQualifiedName(line)
      }
    },
    {
      beforeEach: async () => {
        metadata = await getDefinition({})
        lines = nextLines()
      },
    }
  )
})

for (const size of warmSizes) {
  const metadata: MetadataRepository = await getDefinition({})

  describe(`phase-metadata-lookup-warm-${size}`, () => {
    const nextLines = createSameContentLines(size)
    let lines: readonly string[]

    perfBench(
      `metadata-lookup-warm-${size}`,
      () => {
        for (const line of lines) {
          metadata.get(line)
        }
      },
      {
        // Only the lines are rebuilt here: the registry stays warm across
        // every sample, which is the whole point of this variant.
        beforeEach: () => {
          lines = nextLines()
        },
      }
    )
  })

  describe(`phase-fqn-resolution-warm-${size}`, () => {
    const nextLines = createSameContentLines(size)
    let lines: readonly string[]

    perfBench(
      `fqn-resolution-warm-${size}`,
      () => {
        for (const line of lines) {
          metadata.getFullyQualifiedName(line)
        }
      },
      {
        beforeEach: () => {
          lines = nextLines()
        },
      }
    )
  })
}
