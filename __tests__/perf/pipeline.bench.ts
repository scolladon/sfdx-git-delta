import { describe } from 'vitest'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import ChangeSet from '../../src/utils/changeSet.js'
import { computeTreeIndexScope } from '../../src/utils/treeIndexScope.js'
import {
  generateDiffFixtures,
  generateManifestElements,
} from './fixtures/generateFixtures.js'
import { perfBench } from './harness/perfBench.js'

const metadata = await getDefinition({})

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const { lines } = generateDiffFixtures(size)
  const elements = generateManifestElements(size)

  describe(`pipeline-${size}`, () => {
    perfBench(`pipeline-${size}-tree-scope`, () => {
      computeTreeIndexScope(lines, metadata)
    })

    perfBench(`pipeline-${size}-manifest-aggregation`, () => {
      ChangeSet.from(elements)
    })
  })
}
