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

describe('Given a mutant tally to score', () => {
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

  describe('When the detected mutants are a fraction of the total', () => {
    it('Then the score keeps full float precision, unrounded', () => {
      const sut = scoreOf

      const result = sut(buildTally({ killed: 2, survived: 1 }))

      expect(result).toBe(66.66666666666666)
    })
  })

  describe('When one mutant survived and nothing else', () => {
    it('Then the score is a real zero, distinct from null', () => {
      const sut = scoreOf

      const result = sut(buildTally({ survived: 1 }))

      expect(result).toBe(0)
    })
  })
})

describe('Given a score', () => {
  describe('When the score is null', () => {
    it('Then the format is n/a', () => {
      const sut = formatScore

      const result = sut(null)

      expect(result).toBe('n/a')
    })
  })

  describe('When the score is a number', () => {
    it.each([
      [66.66666666666666, '66.67%'],
      [33.33333333333333, '33.33%'],
      [87.5, '87.50%'],
      [0.0625, '0.06%'],
      [0, '0.00%'],
    ])('Then %d formats as %s', (score, expected) => {
      const sut = formatScore

      const result = sut(score)

      expect(result).toBe(expected)
    })
  })

  // Accepted collision, pinned so it is a decision rather than a surprise: a
  // score small enough to round to zero is indistinguishable from a real zero
  // once formatted. null is what keeps "never measured" separate; two decimal
  // places is not enough to also separate "measured, almost nothing killed".
  describe('When the score is non-zero but rounds to zero', () => {
    it('Then it formats as a real zero would', () => {
      const sut = formatScore

      const result = sut(0.004)

      expect(result).toBe('0.00%')
    })
  })
})

describe('Given a named tally', () => {
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

describe('Given a mutation report', () => {
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
    it('Then unmeasurable files render n/a without moving the aggregate', () => {
      const sut = buildSummaryTable

      const result = sut(
        buildReport({
          'a.ts': [{ status: 'Killed' }],
          'b.ts': [{ status: 'Survived' }],
          'c.ts': [{ status: 'Ignored' }, { status: 'RuntimeError' }],
        })
      )

      expect(result).toBe(
        [
          '| File | Score | Killed | Survived | Timeout | No Coverage |',
          '|-|-|-|-|-|-|',
          '| All files | 50.00% | 1 | 1 | 0 | 0 |',
          '| a.ts | 100.00% | 1 | 0 | 0 | 0 |',
          '| b.ts | 0.00% | 0 | 1 | 0 | 0 |',
          '| c.ts | n/a | 0 | 0 | 0 | 0 |',
        ].join('\n')
      )
    })
  })
})
