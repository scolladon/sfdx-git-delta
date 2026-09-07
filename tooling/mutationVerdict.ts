// Classifies a mutation-testing report so a runner that executed no tests
// is reported as an error rather than a fabricated 0% score.

type MutantStatus = string // 'Killed' | 'Survived' | 'NoCoverage' | 'Timeout' | 'Ignored' | ...

type Mutant = Readonly<{
  status: MutantStatus
  coveredBy?: readonly string[]
  testsCompleted?: number
}>

export type MutationReport = Readonly<{
  files: Readonly<Record<string, Readonly<{ mutants: readonly Mutant[] }>>>
}>

export type MutationRunVerdict =
  | 'vacuous'
  | 'measured'
  | 'no-coverage'
  | 'absent'

const isCovered = (mutant: Mutant): boolean =>
  (mutant.coveredBy?.length ?? 0) > 0

const hasCompletedNoTests = (mutant: Mutant): boolean =>
  mutant.testsCompleted === 0 || mutant.testsCompleted === undefined

const isMeasuredStatus = (mutant: Mutant): boolean =>
  mutant.status === 'Killed' || mutant.status === 'Timeout'

const flattenMutants = (report: MutationReport): readonly Mutant[] =>
  Object.values(report.files)
    .flatMap(file => file.mutants)
    .filter(mutant => mutant.status !== 'Ignored')

export const classifyRun = (
  report: MutationReport | null
): MutationRunVerdict => {
  if (report === null) return 'absent'

  const mutants = flattenMutants(report)

  if (!mutants.some(isCovered)) return 'no-coverage'

  const isVacuous =
    !mutants.some(isMeasuredStatus) && mutants.every(hasCompletedNoTests)

  return isVacuous ? 'vacuous' : 'measured'
}
