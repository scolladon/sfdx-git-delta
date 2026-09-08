#!/usr/bin/env node
// Computes the incremental mutation-testing scope from a plain git diff (no
// shell, no pipeline — a non-zero git exit propagates instead of being
// swallowed by a pipeline), runs Stryker against it, and reports the run
// honestly: an empty scope says "not run", a runner that executed no tests
// says "error" and prints no score, and only a real run reports one.

import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import strykerConfigRaw from '../stryker.conf.mjs'
import { applyNegations, negationsOf } from './mutationScope.ts'
import { buildSummaryTable } from './mutationScore.ts'
import type { MutationReport } from './mutationVerdict.ts'
import { classifyRun } from './mutationVerdict.ts'

type StrykerConfigShape = Readonly<{
  mutate: readonly string[]
  jsonReporter: Readonly<{ fileName: string }>
}>

const strykerConfig = strykerConfigRaw as StrykerConfigShape
const reportPath = strykerConfig.jsonReporter.fileName
const commentPath = join(dirname(reportPath), 'comment.md')

const NOT_RUN_MESSAGE =
  'Mutation testing not run: no mutable source changed against origin/main'
const NO_MUTANTS_MESSAGE =
  'Mutation testing not run: every mutant in the scoped diff was ignored'
const NO_TEST_COVERS_MESSAGE = 'No test covers the changed code'
const VACUOUS_MESSAGE =
  'Mutation run executed no tests against any covered mutant — the test runner did not run, the score above is not a measurement'
const ABSENT_MESSAGE =
  'Mutation run produced no evidence: the report file was not written'
const BREAK_THRESHOLD_MESSAGE =
  'Mutation score is below the configured break threshold'

// -- Reporting surfaces: console annotation, step summary, comment file --
//
// No GitHub token, repository or PR number is read here: this script runs
// inside the same job that executes the pull request's own code under
// Stryker, so it must not hold anything that can write to GitHub. Posting
// is a separate job's job — see the `mutation-comment` job, which reads
// the file this writes from the uploaded `mutation-report` artifact.

const appendStepSummary = (text: string): void => {
  const summaryPath = process.env['GITHUB_STEP_SUMMARY']
  if (!summaryPath) return
  appendFileSync(summaryPath, `${text}\n`)
}

const writeCommentFile = (body: string): void => {
  // reports/ is gitignored and absent from a fresh checkout — the `absent`
  // verdict means Stryker wrote no report, precisely the case where it may
  // never have created this directory either.
  mkdirSync(dirname(commentPath), { recursive: true })
  writeFileSync(commentPath, body)
}

// -- Scope: plain git diff, then the config's own mutate negations -------

const changedTsFiles = (): readonly string[] =>
  execFileSync(
    'git',
    [
      '--no-pager',
      'diff',
      '--name-only',
      '--diff-filter=AM',
      '--merge-base',
      'origin/main',
      '--',
      'src',
    ],
    { encoding: 'utf-8' }
  )
    .split('\n')
    .filter(path => path.endsWith('.ts'))

// -- Stryker, run without a shell -----------------------------------------

const resolveStrykerCliPath = (): string => {
  const require = createRequire(import.meta.url)
  const corePackageJsonPath = require.resolve(
    '@stryker-mutator/core/package.json'
  )
  return join(dirname(corePackageJsonPath), 'bin/stryker.js')
}

const numericExitStatusOf = (error: unknown): number => {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status: unknown }).status
      : undefined
  if (typeof status !== 'number') throw error
  return status
}

const runStryker = (mutateList: string): number => {
  const strykerCliPath = resolveStrykerCliPath()
  console.log(`Running Stryker with --mutate ${mutateList}`)
  try {
    execFileSync(
      process.execPath,
      [strykerCliPath, 'run', '--mutate', mutateList],
      { stdio: 'inherit' }
    )
    return 0
  } catch (error) {
    return numericExitStatusOf(error)
  }
}

// -- Reporting the outcome ------------------------------------------------

// Every not-run outcome — an empty scope that never reaches Stryker, or a
// scoped diff whose mutants were all ignored — still needs a comment.md: the
// mutation-comment job downloads whatever artifact this run produced, and a
// missing file there is what turns an advisory gate into a hard failure.
const reportNotRun = (message: string): void => {
  console.log(message)
  console.log(`::notice::${message}`)
  appendStepSummary(message)
  writeCommentFile(message)
}

const reportGuardFailure = (message: string): void => {
  console.log(`::error::${message}`)
  appendStepSummary(message)
  writeCommentFile(message)
}

const reportScore = (
  report: MutationReport,
  strykerExitStatus: number,
  verdict: 'measured' | 'no-coverage'
): void => {
  const table = buildSummaryTable(report)
  const noCoverageLine =
    verdict === 'no-coverage' ? `${NO_TEST_COVERS_MESSAGE}\n` : ''
  const errorLine =
    strykerExitStatus === 0 ? '' : `::error::${BREAK_THRESHOLD_MESSAGE}\n`
  const body = `${noCoverageLine}${errorLine}${table}`
  console.log(body)
  appendStepSummary(body)
  writeCommentFile(body)
}

// -- Main -------------------------------------------------------------------

const deleteStaleFile = (path: string): void => {
  if (existsSync(path)) rmSync(path)
}

deleteStaleFile(reportPath)
deleteStaleFile(commentPath)

const negations = negationsOf(strykerConfig.mutate)
const scopedFiles = applyNegations(changedTsFiles(), negations)

if (scopedFiles.length === 0) {
  reportNotRun(NOT_RUN_MESSAGE)
  process.exit(0)
}

const strykerExitStatus = runStryker(scopedFiles.join(','))

const report = existsSync(reportPath)
  ? (JSON.parse(readFileSync(reportPath, 'utf-8')) as MutationReport)
  : null
const verdict = classifyRun(report)

if (verdict === 'absent') {
  reportGuardFailure(ABSENT_MESSAGE)
  process.exit(strykerExitStatus === 0 ? 1 : strykerExitStatus)
}

if (verdict === 'vacuous') {
  reportGuardFailure(VACUOUS_MESSAGE)
  process.exit(1)
}

if (verdict === 'no-mutants') {
  reportNotRun(NO_MUTANTS_MESSAGE)
  process.exit(0)
}

reportScore(report as MutationReport, strykerExitStatus, verdict)
process.exit(strykerExitStatus)
