// Computes the reported mutation score. Kept apart from the run shell so the
// number this project publishes is itself unit-tested: "never measured" and
// "measured zero" are different answers, and only a test can hold them apart.

import type { MutationReport } from './mutationVerdict.ts'

export type MutantTally = Readonly<{
  killed: number
  survived: number
  timeout: number
  noCoverage: number
}>

export const tallyStatuses = (
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

// null, not 0, when nothing was measured: a file whose mutants are all
// Ignored (routine under ignoreStatic: true) or all RuntimeError/CompileError
// (dropped by tallyStatuses's default arm) has no score to report — 0.00%
// would read as a measurement that was never taken.
export const scoreOf = (tally: MutantTally): number | null => {
  const detected = tally.killed + tally.timeout
  const total = detected + tally.survived + tally.noCoverage
  return total > 0 ? (detected / total) * 100 : null
}

export const formatScore = (score: number | null): string =>
  score === null ? 'n/a' : `${score.toFixed(2)}%`

export const summaryRow = (name: string, tally: MutantTally): string =>
  `| ${name} | ${formatScore(scoreOf(tally))} | ${tally.killed} | ${tally.survived} | ${tally.timeout} | ${tally.noCoverage} |`

export const buildSummaryTable = (report: MutationReport): string => {
  const entries = Object.entries(report.files)
  const overall = tallyStatuses(entries.flatMap(([, file]) => file.mutants))
  const header =
    '| File | Score | Killed | Survived | Timeout | No Coverage |\n|-|-|-|-|-|-|'
  const fileRows = entries.map(([filePath, file]) =>
    summaryRow(filePath, tallyStatuses(file.mutants))
  )
  return [header, summaryRow('All files', overall), ...fileRows].join('\n')
}
