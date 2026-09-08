import { describe, expect, it } from 'vitest'

import {
  buildSummaryTable,
  formatScore,
  type MutantTally,
  scoreOf,
  summaryRow,
  tallyStatuses,
} from '../../../tooling/mutationScore.ts'
import type { MutationReport } from '../../../tooling/mutationVerdict.ts'

type MutantFixture = Readonly<{ status: string }>

const buildTally = (tally: Partial<MutantTally>): MutantTally => ({
  killed: 0,
  survived: 0,
  timeout: 0,
  noCoverage: 0,
  ...tally,
})

const buildReport = (
  files: Readonly<Record<string, readonly MutantFixture[]>>
): MutationReport => ({
  files: Object.fromEntries(
    Object.entries(files).map(([path, mutants]) => [path, { mutants }])
  ),
})

describe('Given a mutant tally', () => {
  describe('When a single mutant of each status is tallied', () => {
    it('Then each counter reads one', () => {
      const sut = tallyStatuses

      const result = sut([
        { status: 'Killed' },
        { status: 'Survived' },
        { status: 'Timeout' },
        { status: 'NoCoverage' },
      ])

      expect(result).toEqual({
        killed: 1,
        survived: 1,
        timeout: 1,
        noCoverage: 1,
      })
    })
  })

  describe('When mutants are RuntimeError, CompileError, or Ignored', () => {
    it('Then every counter stays zero', () => {
      const sut = tallyStatuses

      const result = sut([
        { status: 'RuntimeError' },
        { status: 'CompileError' },
        { status: 'Ignored' },
      ])

      expect(result).toEqual({
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
      })
    })
  })

  describe('When the mutant list is empty', () => {
    it('Then every counter stays zero', () => {
      const sut = tallyStatuses

      const result = sut([])

      expect(result).toEqual({
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
      })
    })
  })
})

describe('Given a mutant tally, when computing the score', () => {
  describe('When nothing was measured', () => {
    it('Then the score is null', () => {
      const sut = scoreOf

      const result = sut(buildTally({}))

      expect(result).toBeNull()
    })
  })

  describe('When every mutant was killed', () => {
    it('Then the score is 100', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 3 }))

      expect(result).toBe(100)
    })
  })

  describe('When every mutant timed out', () => {
    it('Then timeout counts as detected and the score is 100', () => {
      const sut = scoreOf

      const result = sut(buildTally({ timeout: 2 }))

      expect(result).toBe(100)
    })
  })

  describe('When one mutant was killed and one had no coverage', () => {
    it('Then noCoverage counts in the denominator and the score is 50', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 1, noCoverage: 1 }))

      expect(result).toBe(50)
    })
  })

  describe('When two mutants were killed and one survived', () => {
    it('Then the score rounds up', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 2, survived: 1 }))

      expect(result).toBe(66.66666666666666)
    })
  })

  describe('When one mutant was killed and two survived', () => {
    it('Then the score rounds down', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 1, survived: 2 }))

      expect(result).toBe(33.33333333333333)
    })
  })

  describe('When one mutant survived and nothing else', () => {
    it('Then the score is a real zero, distinct from null', () => {
      const sut = scoreOf

      const result = sut(buildTally({ survived: 1 }))

      expect(result).toBe(0)
    })
  })

  describe('When one mutant was killed among 1600 measured', () => {
    it('Then a small non-zero score keeps its precision', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 1, survived: 1599 }))

      expect(result).toBe(0.0625)
    })
  })

  describe('When seven mutants were killed and one survived', () => {
    it('Then an exact half keeps its trailing zero', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 7, survived: 1 }))

      expect(result).toBe(87.5)
    })
  })
})

describe('Given a score, when formatting it', () => {
  describe('When the score is null', () => {
    it('Then the format is n/a', () => {
      const sut = formatScore

      const result = sut(null)

      expect(result).toBe('n/a')
    })
  })

  describe('When the score is a number', () => {
    it('Then the format keeps two decimal places with a percent sign', () => {
      const sut = formatScore

      const result = sut(66.66666666666666)

      expect(result).toBe('66.67%')
    })
  })
})

describe('Given a named tally, when building its summary row', () => {
  describe('When the tally has one killed and one survived mutant', () => {
    it('Then the row renders the name, score, and every counter', () => {
      const sut = summaryRow

      const result = sut('src/x.ts', {
        killed: 1,
        survived: 1,
        timeout: 0,
        noCoverage: 0,
      })

      expect(result).toBe('| src/x.ts | 50.00% | 1 | 1 | 0 | 0 |')
    })
  })
})

describe('Given a mutation report, when building the summary table', () => {
  describe('When the report has no files', () => {
    it('Then the table shows n/a for an all-zero All files row', () => {
      const sut = buildSummaryTable

      const result = sut(buildReport({}))

      expect(result).toBe(
        [
          '| File | Score | Killed | Survived | Timeout | No Coverage |',
          '|-|-|-|-|-|-|',
          '| All files | n/a | 0 | 0 | 0 | 0 |',
        ].join('\n')
      )
    })
  })

  describe('When the report has two files with different outcomes', () => {
    it('Then the All files row aggregates rather than repeating the first file', () => {
      const sut = buildSummaryTable

      const result = sut(
        buildReport({
          'a.ts': [{ status: 'Killed' }],
          'b.ts': [{ status: 'Survived' }],
        })
      )

      expect(result).toBe(
        [
          '| File | Score | Killed | Survived | Timeout | No Coverage |',
          '|-|-|-|-|-|-|',
          '| All files | 50.00% | 1 | 1 | 0 | 0 |',
          '| a.ts | 100.00% | 1 | 0 | 0 | 0 |',
          '| b.ts | 0.00% | 0 | 1 | 0 | 0 |',
        ].join('\n')
      )
    })
  })
})
