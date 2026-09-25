import { describe, vi } from 'vitest'
import { EMPTY_TREE_READER } from '../../lib/adapter/treeReader.js'
import { getDefinition } from '../../lib/metadata/metadataManager.js'
import DiffLineInterpreter from '../../lib/service/diffLineInterpreter.js'
import type { Config } from '../../lib/types/config.js'
import { generateDiffFixtures } from './fixtures/generateFixtures.ts'
import { perfBench } from './harness/perfBench.ts'
import { sourceDirs } from './harness/sourceDirs.ts'

vi.mock('../../lib/adapter/GitAdapter.js', () => {
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
    perfBench(`pipeline-handler-dispatch-${size}`, async () => {
      const config = createConfig()
      const interpreter = new DiffLineInterpreter({
        config,
        metadata,
        trees: EMPTY_TREE_READER,
      })
      await interpreter.process(lines)
    })
  })
}
