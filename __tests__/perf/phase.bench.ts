import { bench, describe } from 'vitest'
import { GIT_DIFF_TYPE_REGEX } from '../../src/constant/gitConstants.js'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import { generateDiffFixtures } from './fixtures/generateFixtures.js'

const metadata: MetadataRepository = await getDefinition({})

const sizes = ['small', 'medium', 'large'] as const

describe('phase-metadata-loading', () => {
  bench('metadata-registry-load', async () => {
    await getDefinition({})
  })
})

for (const size of sizes) {
  const { lines } = generateDiffFixtures(size)
  const paths = lines.map(line => line.replace(GIT_DIFF_TYPE_REGEX, ''))

  describe(`phase-metadata-lookup-${size}`, () => {
    bench(`metadata-lookup-${size}`, () => {
      for (const path of paths) {
        metadata.get(path)
      }
    })
  })

  describe(`phase-metadata-has-${size}`, () => {
    bench(`metadata-has-${size}`, () => {
      for (const path of paths) {
        metadata.has(path)
      }
    })
  })

  describe(`phase-fqn-resolution-${size}`, () => {
    bench(`fqn-resolution-${size}`, () => {
      for (const path of paths) {
        metadata.getFullyQualifiedName(path)
      }
    })
  })
}
