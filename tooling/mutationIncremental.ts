#!/usr/bin/env node
// Computes the incremental mutation-testing scope from a plain git diff (no
// shell, no pipeline — a non-zero git exit propagates instead of being
// swallowed by a pipeline), runs Stryker against it, and reports the run
// honestly: an empty scope says "not run", a runner that executed no tests
// says "error" and prints no score, and only a real run reports one.

import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
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

type GithubComment = Readonly<{ id: number; body?: string }>

const strykerConfig = strykerConfigRaw as StrykerConfigShape
const reportPath = strykerConfig.jsonReporter.fileName

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
const PR_COMMENT_MARKER = '<!-- incremental-mutation-testing -->'

// -- Reporting surfaces: console annotation, step summary, PR comment ----

const appendStepSummary = (text: string): void => {
  const summaryPath = process.env['GITHUB_STEP_SUMMARY']
  if (!summaryPath) return
  appendFileSync(summaryPath, `${text}\n`)
}

const findMarkedComment = (
  comments: readonly GithubComment[]
): GithubComment | undefined =>
  comments.find(comment => comment.body?.includes(PR_COMMENT_MARKER))

const isGithubCommentArray = (
  value: unknown
): value is readonly GithubComment[] => Array.isArray(value)

// Never log the response body or headers here: the body can carry
// GitHub's own diagnostic text and the headers carry the bearer token.
const logHttpFailure = (action: string, res: Response, url: string): void => {
  console.log(`::error::${action} failed: ${res.status} ${url}`)
}

const postPrComment = async (body: string): Promise<void> => {
  const token = process.env['GITHUB_TOKEN']
  const repo = process.env['GITHUB_REPOSITORY']
  const prNumber = process.env['PR_NUMBER']
  if (!token || !repo || !prNumber) return

  const [owner, repoName] = repo.split('/')
  const apiBase = `https://api.github.com/repos/${owner}/${repoName}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
  const commentBody = `${PR_COMMENT_MARKER}\n${body}`

  const listUrl = `${apiBase}/issues/${prNumber}/comments?per_page=100`
  const commentsRes = await fetch(listUrl, { headers })
  if (!commentsRes.ok) {
    logHttpFailure('Listing PR comments', commentsRes, listUrl)
    return
  }
  const commentsBody: unknown = await commentsRes.json()
  const comments = isGithubCommentArray(commentsBody) ? commentsBody : []
  const existing = findMarkedComment(comments)

  const request = existing
    ? { url: `${apiBase}/issues/comments/${existing.id}`, method: 'PATCH' }
    : { url: `${apiBase}/issues/${prNumber}/comments`, method: 'POST' }

  const writeRes = await fetch(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify({ body: commentBody }),
  })
  if (!writeRes.ok) {
    logHttpFailure('Posting PR comment', writeRes, request.url)
  }
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

const reportGuardFailure = async (message: string): Promise<void> => {
  console.log(`::error::${message}`)
  appendStepSummary(message)
  await postPrComment(message)
}

const reportScore = async (
  report: MutationReport,
  strykerExitStatus: number,
  verdict: 'measured' | 'no-coverage'
): Promise<void> => {
  const table = buildSummaryTable(report)
  const noCoverageLine =
    verdict === 'no-coverage' ? `${NO_TEST_COVERS_MESSAGE}\n` : ''
  const errorLine =
    strykerExitStatus === 0 ? '' : `::error::${BREAK_THRESHOLD_MESSAGE}\n`
  const body = `${noCoverageLine}${errorLine}${table}`
  console.log(body)
  appendStepSummary(body)
  await postPrComment(body)
}

// -- Main -------------------------------------------------------------------

if (existsSync(reportPath)) {
  rmSync(reportPath)
}

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
  await reportGuardFailure(ABSENT_MESSAGE)
  process.exit(strykerExitStatus === 0 ? 1 : strykerExitStatus)
}

if (verdict === 'vacuous') {
  await reportGuardFailure(VACUOUS_MESSAGE)
  process.exit(1)
}

if (verdict === 'no-mutants') {
  reportNotRun(NO_MUTANTS_MESSAGE)
  process.exit(0)
}

await reportScore(report as MutationReport, strykerExitStatus, verdict)
process.exit(strykerExitStatus)
