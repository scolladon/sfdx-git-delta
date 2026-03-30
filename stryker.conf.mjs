const config = {
  coverageAnalysis: 'perTest',
  ignorePatterns: ['lib/', 'reports/', 'bin/', 'e2e/'],
  mutate: [
    'src/**/*.ts',
    '!src/metadata/v*.ts',
    '!src/commands/**/*.ts',
    '!src/constant/cliConstants.ts',
    '!src/utils/__mocks__/**/*.ts',
  ],
  reporters: ['html', 'progress', 'json'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  testRunner: 'vitest',
  thresholds: {
    high: 90,
    low: 80,
    break: 70,
  },
}
export default config
