import { describe, vi } from 'vitest'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import DiffLineInterpreter from '../../src/service/diffLineInterpreter.js'
import type { Config } from '../../src/types/config.js'
import { sourceDirs } from '../__utils__/sourceDirs.js'
import { getContext } from '../__utils__/testWork.js'
import { generateDiffFixtures } from './fixtures/generateFixtures.js'
import { perfBench } from './harness/perfBench.js'

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
    perfBench(`pipeline-handler-dispatch-${size}`, async () => {
      const config = createConfig()
      const interpreter = new DiffLineInterpreter(
        getContext({ config, metadata })
      )
      await interpreter.process(lines)
    })
  })
}
