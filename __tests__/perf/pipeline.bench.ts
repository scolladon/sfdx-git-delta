import { bench, describe } from 'vitest'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import ChangeSet from '../../src/utils/changeSet.js'
import { computeTreeIndexScope } from '../../src/utils/treeIndexScope.js'
import {
  generateDiffFixtures,
  generateHandlerResult,
} from './fixtures/generateFixtures.js'

const metadata = await getDefinition({})

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const { lines } = generateDiffFixtures(size)
  const handlerResult = generateHandlerResult(size)

  describe(`pipeline-${size}`, () => {
    bench(`pipeline-${size}-tree-scope`, () => {
      computeTreeIndexScope(lines, metadata)
    })

    bench(`pipeline-${size}-manifest-aggregation`, () => {
      ChangeSet.from(handlerResult.manifests)
    })
  })
}
