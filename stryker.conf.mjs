const config = {
  coverageAnalysis: 'perTest',
  // Static mutants live in top-level / module-init code that runs once
  // per worker. With perTest coverage Stryker has to spin up a fresh
  // worker for every static mutant, which Stryker itself reports as
  // ~75% of the wall time on this codebase. Skipping them drops the
  // CI run from ~60min to ~15min while only narrowing scope to mutants
  // that can actually be killed by per-test execution.
  ignoreStatic: true,
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
