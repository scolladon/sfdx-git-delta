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
    // Pure-constant modules: mutants on top-level `const FOO = '...'`
    // bindings cannot be killed under perTest+ignoreStatic, since the
    // module is loaded once per worker and the mutated value never
    // re-propagates between tests. Tests that consume these constants
    // assert their effect via downstream behavior; equivalent here.
    '!src/constant/cliConstants.ts',
    '!src/constant/libConstant.ts',
    '!src/utils/xmlHelper.ts',
    '!src/utils/__mocks__/**/*.ts',
  ],
  // Known surviving BlockStatement mutants on `} catch (error) {` /
  // `} finally {` bodies that the test surface intentionally does not
  // probe (observability-only Logger.debug calls). Biome's brace style
  // joins the closing `}` with the catch/finally keyword, so a
  // `// Stryker disable next-line` comment cannot attach to the body in
  // valid JS syntax. Killing these would require either spying on Logger
  // (couples tests to log message format — explicitly avoided by
  // existing project pattern) or relaxing biome's brace style (broader
  // tooling change). Documented here for traceability:
  //   - src/adapter/GitAdapter.ts L146 (preBuildTreeIndex catch)
  //   - src/adapter/GitAdapter.ts L309 (streamArchive finally)
  //   - src/adapter/ioExecutor.ts  L148 (gitDirCopy catch)
  //   - src/utils/configValidator.ts L136 (_getApiVersion catch)
  reporters: ['html', 'progress', 'json'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  testRunner: 'vitest',
  thresholds: {
    high: 95,
    low: 90,
    break: 90,
  },
}
export default config
