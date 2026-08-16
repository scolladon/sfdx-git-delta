import { bench, describe, vi } from 'vitest'
import { EMPTY_TREE_INDEXES } from '../../src/adapter/treeIndexes.js'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import DiffLineInterpreter from '../../src/service/diffLineInterpreter.js'
import type { Config } from '../../src/types/config.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { generateDiffFixtures } from './fixtures/generateFixtures.js'

vi.mock('../../src/adapter/GitAdapter.js', () => {
  const mockAdapter = {
    pathExists: vi.fn().mockResolvedValue(true),
    getStringContent: vi.fn().mockResolvedValue('<xml>mock</xml>'),
    getBufferContent: vi.fn().mockResolvedValue(Buffer.from('<xml>mock</xml>')),
    buildTreeIndex: vi.fn().mockResolvedValue(undefined),
    grepUnderPaths: vi.fn().mockResolvedValue([]),
    grepMatchingPathspecs: vi.fn().mockResolvedValue([]),
  }
  return {
    default: {
      getInstance: vi.fn().mockReturnValue(mockAdapter),
      closeAll: vi.fn().mockResolvedValue(undefined),
    },
  }
})

const metadata = await getDefinition({})

const createConfig = (): Config => ({
  source: sourceDirs('force-app/main/default'),
  output: '/tmp/output',
  generateDelta: true,
  to: 'HEAD',
  from: 'HEAD~1',
  mergeBase: false,
  ignore: '',
  ignoreDestructive: '',
  apiVersion: -1,
  repo: '.',
  ignoreWhitespace: false,
  include: '',
  includeDestructive: '',
})

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const { lines } = generateDiffFixtures(size)

  describe(`pipeline-handler-${size}`, () => {
    bench(`pipeline-handler-dispatch-${size}`, async () => {
      const config = createConfig()
      const interpreter = new DiffLineInterpreter(
        config,
        metadata,
        EMPTY_TREE_INDEXES
      )
      await interpreter.process(lines)
    })
  })
}
