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
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import strykerConfigRaw from '../stryker.conf.mjs'
import type { MutationReport } from './mutationVerdict.ts'
import { classifyRun } from './mutationVerdict.ts'

type StrykerConfigShape = Readonly<{
  mutate: readonly string[]
  jsonReporter: Readonly<{ fileName: string }>
}>

type MutantTally = Readonly<{
  killed: number
  survived: number
  timeout: number
  noCoverage: number
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
  writeFileSync(commentPath, body)
}

// -- Scope: plain git diff, then the config's own mutate negations -------

const escapeGlobLiteral = (chunk: string): string =>
  chunk.replace(/[.+^${}()|[\]\\]/g, '\\$&')

const convertGlobWildcards = (chunk: string): string =>
  escapeGlobLiteral(chunk).replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')

// Supports two globstar forms, matching the negations this project writes:
// a mid-pattern `**/` (zero or more directories) and a trailing `/**`
// (the directory itself plus everything under it, any depth). A bare `**`
// anywhere else (e.g. `a**b`) is not a globstar here — it degrades to two
// single-segment wildcards, same as before this function grew `**` support.
const TRAILING_GLOBSTAR = /\/\*\*$/

const globToRegExp = (pattern: string): RegExp => {
  const hasTrailingGlobstar = TRAILING_GLOBSTAR.test(pattern)
  const body = hasTrailingGlobstar ? pattern.slice(0, -'/**'.length) : pattern
  const boundary = body.split('**/').map(convertGlobWildcards).join('(?:.*/)?')
  const suffix = hasTrailingGlobstar ? '(?:/.*)?' : ''
  return new RegExp(`^${boundary}${suffix}$`)
}

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

const negationsOf = (mutate: readonly string[]): readonly RegExp[] =>
  mutate
    .filter(pattern => pattern.startsWith('!'))
    .map(pattern => globToRegExp(pattern.slice(1)))

const applyNegations = (
  files: readonly string[],
  negations: readonly RegExp[]
): readonly string[] =>
  files.filter(file => !negations.some(negation => negation.test(file)))

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

// -- Score summary, built only when the vacuity guard is silent ----------

const tallyStatuses = (
  mutants: readonly Readonly<{ status: string }>[]
): MutantTally => {
  const empty: MutantTally = {
    killed: 0,
    survived: 0,
    timeout: 0,
    noCoverage: 0,
  }
  return mutants.reduce((tally, mutant) => {
    switch (mutant.status) {
      case 'Killed':
        return { ...tally, killed: tally.killed + 1 }
      case 'Survived':
        return { ...tally, survived: tally.survived + 1 }
      case 'Timeout':
        return { ...tally, timeout: tally.timeout + 1 }
      case 'NoCoverage':
        return { ...tally, noCoverage: tally.noCoverage + 1 }
      default:
        return tally
    }
  }, empty)
}

const scoreOf = (tally: MutantTally): number => {
  const detected = tally.killed + tally.timeout
  const total = detected + tally.survived + tally.noCoverage
  return total > 0 ? (detected / total) * 100 : 0
}

const summaryRow = (name: string, tally: MutantTally): string =>
  `| ${name} | ${scoreOf(tally).toFixed(2)}% | ${tally.killed} | ${tally.survived} | ${tally.timeout} | ${tally.noCoverage} |`

const buildSummaryTable = (report: MutationReport): string => {
  const entries = Object.entries(report.files)
  const overall = tallyStatuses(entries.flatMap(([, file]) => file.mutants))
  const header =
    '| File | Score | Killed | Survived | Timeout | No Coverage |\n|-|-|-|-|-|-|'
  const fileRows = entries.map(([filePath, file]) =>
    summaryRow(filePath, tallyStatuses(file.mutants))
  )
  return [header, summaryRow('All files', overall), ...fileRows].join('\n')
}

// -- Reporting the outcome ------------------------------------------------

const reportNotRun = (message: string): void => {
  console.log(message)
  console.log(`::notice::${message}`)
  appendStepSummary(message)
}

// Distinct from reportNotRun: a scoped diff whose mutants were all ignored
// still has something worth telling a reviewer, so it also gets a comment
// file, unlike the empty-scope case above which never reaches Stryker.
const reportNoMutants = (message: string): void => {
  reportNotRun(message)
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
  reportNoMutants(NO_MUTANTS_MESSAGE)
  process.exit(0)
}

reportScore(report as MutationReport, strykerExitStatus, verdict)
process.exit(strykerExitStatus)
