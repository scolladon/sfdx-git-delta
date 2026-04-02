import { bench, describe, vi } from 'vitest'
import { getDefinition } from '../../src/metadata/metadataManager.js'
import DiffLineInterpreter from '../../src/service/diffLineInterpreter.js'
import type { Work } from '../../src/types/work.js'
import { generateDiffFixtures } from './fixtures/generateFixtures.js'

vi.mock('../../src/adapter/GitAdapter.js', () => {
  const mockAdapter = {
    pathExists: vi.fn().mockResolvedValue(true),
    getStringContent: vi.fn().mockResolvedValue('<xml>mock</xml>'),
    getBufferContent: vi.fn().mockResolvedValue(Buffer.from('<xml>mock</xml>')),
    getFilesPath: vi.fn().mockResolvedValue([]),
    listDirAtRevision: vi.fn().mockResolvedValue([]),
    preBuildTreeIndex: vi.fn().mockResolvedValue(undefined),
    gitGrep: vi.fn().mockResolvedValue([]),
    closeBatchProcess: vi.fn(),
  }
  return {
    default: {
      getInstance: vi.fn().mockReturnValue(mockAdapter),
      closeAll: vi.fn(),
    },
  }
})

const metadata = await getDefinition({})

const createWork = (): Work => ({
  diffs: {
    package: new Map(),
    destructiveChanges: new Map(),
  },
  config: {
    source: ['force-app/main/default'],
    output: '/tmp/output',
    generateDelta: true,
    to: 'HEAD',
    from: 'HEAD~1',
    ignore: '',
    ignoreDestructive: '',
    apiVersion: -1,
    repo: '.',
    ignoreWhitespace: false,
    include: '',
    includeDestructive: '',
  },
  warnings: [],
})

const sizes = ['small', 'medium', 'large'] as const

for (const size of sizes) {
  const { lines } = generateDiffFixtures(size)

  describe(`pipeline-handler-${size}`, () => {
    bench(`pipeline-handler-dispatch-${size}`, async () => {
      const work = createWork()
      const interpreter = new DiffLineInterpreter(work, metadata)
      await interpreter.process(lines)
    })
  })
}
