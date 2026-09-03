const config = {
  // Stryker's sandbox TSConfigPreprocessor calls ts.parseConfigFileTextToJson,
  // removed in TypeScript 7, and crashes the run outright. Pointing at a
  // file that does not exist makes the preprocessor a no-op: it looks the
  // name up in the sandbox and skips when absent. Nothing here needs the
  // rewrite — the vitest runner resolves through vitest.config.ts, not tsc.
  tsconfigFile: 'tsconfig.stryker-absent.json',
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
    // (xmlHelper.ts is NOT excluded: its constants are static — and so
    // ignored — while its escapeXmlText function is behavioral and killed
    // by its own unit tests.)
    '!src/constant/cliConstants.ts',
    '!src/constant/libConstant.ts',
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
  // tooling change). Documented here for traceability, by symbol rather
  // than by line — line numbers in this block had already rotted twice
  // before anyone noticed, because nothing verifies them:
  //   - src/adapter/GitAdapter.ts      buildTreeIndex   catch
  //   - src/adapter/GitAdapter.ts      streamArchive    finally
  //   - src/adapter/ioExecutor.ts      _executeGitDirCopy catch
  //   - src/utils/configValidator.ts   _getApiVersion   catch
  //
  // More documented survivors, found triaging the ignored-addition
  // visibility probe in src/utils/repoGitDiff.ts, also keyed by symbol:
  //   - RepoGitDiff.getLines, the routing loop's `else if (!kept) { continue }`
  //     arm: equivalent. That arm is the last statement of the if/else-if
  //     chain, which is itself the last statement of the
  //     `for (const expanded of this._expandRename(rawLine))` body, so an
  //     emptied block falls through to the same place `continue` would have
  //     jumped to for every value `_expandRename` can yield — there is no
  //     statement after the chain for control to skip.
  //   - RepoGitDiff.getLines, the `if (vouching.size > 0)` guard around the
  //     "held addition(s) survive" Logger.debug call (including its
  //     EqualityOperator and BlockStatement variants, and the ArrayDeclaration/
  //     StringLiteral mutants on the message it builds), and the matching
  //     StringLiteral on _visibleNamesAtTo's fail-closed debug message: same
  //     Logger-spying reason as the block above. Concretely, `Logger.debug`
  //     already gates on `coreLogger.shouldLog(LoggerLevel.DEBUG)` before
  //     using its argument, so the guard's only functional job is to skip
  //     the eager `[...vouching].join(...)` spread — a tagged template's
  //     interpolations run before the tag function (`lazy`) is even called,
  //     so that join would otherwise happen on every run whether or not the
  //     message ends up used. The EqualityOperator mutants (`>= 0` / `<= 0`)
  //     only change when that join runs, never what getLines() yields.
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
