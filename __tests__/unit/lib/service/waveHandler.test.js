'use strict'
const WaveHandler = require('../../../../src/service/waveHandler')
jest.mock('fs')

const testContext = {
  handler: WaveHandler,
  testData: [
    [
      'wave',
      'force-app/main/default/wave/WaveApplicationTest.wapp',
      new Set(['WaveApplicationTest']),
      'WaveApplication',
    ],
    [
      'wave',
      'force-app/main/default/wave/WaveDataflowTest.wdf',
      new Set(['WaveDataflowTest']),
      'WaveDataflow',
    ],
    [
      'wave',
      'force-app/main/default/wave/WaveDashboardTest.wdash',
      new Set(['WaveDashboardTest']),
      'WaveDashboard',
    ],
    [
      'wave',
      'force-app/main/default/wave/WaveDatasetTest.wds',
      new Set(['WaveDatasetTest']),
      'WaveDataset',
    ],
    [
      'wave',
      'force-app/main/default/wave/WaveLensTest.wlens',
      new Set(['WaveLensTest']),
      'WaveLens',
    ],
    [
      'wave',
      'force-app/main/default/wave/WaveRecipeTest.wdpr',
      new Set(['WaveRecipeTest']),
      'WaveRecipe',
    ],
    [
      'wave',
      'force-app/main/default/wave/WaveXmdTest.xmd',
      new Set(['WaveXmdTest']),
      'WaveXmd',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveApplicationTest.wapp',
      new Set(['WaveApplicationTest']),
      'WaveApplication',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveDataflowTest.wdf',
      new Set(['WaveDataflowTest']),
      'WaveDataflow',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveDashboardTest.wdash',
      new Set(['WaveDashboardTest']),
      'WaveDashboard',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveDatasetTest.wds',
      new Set(['WaveDatasetTest']),
      'WaveDataset',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveLensTest.wlens',
      new Set(['WaveLensTest']),
      'WaveLens',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveRecipeTest.wdpr',
      new Set(['WaveRecipeTest']),
      'WaveRecipe',
    ],
    [
      'wave',
      'force-app/main/default/wave/Test/WaveXmdTest.xmd',
      new Set(['WaveXmdTest']),
      'WaveXmd',
    ],
  ],
  work: {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: {}, destructiveChanges: {} },
  },
}

require('fs').__setMockFiles({
  'force-app/main/default/wave/WaveApplicationTest.wapp': 'test',
  'force-app/main/default/wave/WaveDataflowTest.wdf': 'test',
  'force-app/main/default/wave/WaveDashboardTest.wdash': 'test',
  'force-app/main/default/wave/WaveDatasetTest.wds': 'test',
  'force-app/main/default/wave/WaveLensTest.wlens': 'test',
  'force-app/main/default/wave/WaveRecipeTest.wdpr': 'test',
  'force-app/main/default/wave/WaveXmdTest.xmd': 'test',
})

// eslint-disable-next-line no-undef
describe('test WaveHandler', () => {
  // eslint-disable-next-line no-undef
  testHandlerHelper(testContext)
})
