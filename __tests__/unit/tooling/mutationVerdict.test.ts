import { describe, expect, it } from 'vitest'

import {
  classifyRun,
  type MutationReport,
} from '../../../tooling/mutationVerdict.ts'

type MutantFixture = Readonly<{
  status: string
  coveredBy?: readonly string[]
  testsCompleted?: number
}>

const buildReport = (mutants: readonly MutantFixture[]): MutationReport => ({
  files: {
    'some/file.ts': {
      mutants,
    },
  },
})

describe('Given a mutation report', () => {
  describe('When the report is absent', () => {
    it('Then the verdict is absent', () => {
      const sut = classifyRun

      const result = sut(null)

      expect(result).toBe('absent')
    })
  })

  describe('When no remaining mutant has a non-empty coveredBy', () => {
    it('Then the verdict is no-coverage', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'NoCoverage', coveredBy: [] },
        { status: 'NoCoverage' },
      ])

      const result = sut(report)

      expect(result).toBe('no-coverage')
    })
  })

  describe('When the mutant set is empty', () => {
    it('Then the verdict is no-mutants', () => {
      const sut = classifyRun
      const report = buildReport([])

      const result = sut(report)

      expect(result).toBe('no-mutants')
    })
  })

  describe('When every mutant is Ignored', () => {
    it('Then the verdict is no-mutants', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Ignored', coveredBy: ['test A'], testsCompleted: 1 },
        { status: 'Ignored' },
      ])

      const result = sut(report)

      expect(result).toBe('no-mutants')
    })
  })

  describe('When mutants are covered but none ran (testsCompleted is 0)', () => {
    it('Then the verdict is vacuous', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Survived', coveredBy: ['test A'], testsCompleted: 0 },
        { status: 'Survived', coveredBy: ['test B'], testsCompleted: 0 },
      ])

      const result = sut(report)

      expect(result).toBe('vacuous')
    })
  })

  describe('When mutants are covered but none ran (testsCompleted is undefined)', () => {
    it('Then the verdict is vacuous', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Survived', coveredBy: ['test A'] },
      ])

      const result = sut(report)

      expect(result).toBe('vacuous')
    })
  })

  describe('When the only Killed mutant is Ignored', () => {
    it('Then the verdict is vacuous, not measured', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Ignored', coveredBy: ['test A'], testsCompleted: 1 },
        { status: 'Survived', coveredBy: ['test B'], testsCompleted: 0 },
      ])

      const result = sut(report)

      expect(result).toBe('vacuous')
    })
  })

  describe('When at least one mutant is Killed', () => {
    it('Then the verdict is measured', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Killed', coveredBy: ['test A'], testsCompleted: 1 },
        { status: 'Survived', coveredBy: ['test B'], testsCompleted: 0 },
      ])

      const result = sut(report)

      expect(result).toBe('measured')
    })
  })

  describe('When at least one mutant timed out', () => {
    it('Then the verdict is measured', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Timeout', coveredBy: ['test A'], testsCompleted: 1 },
        { status: 'Survived', coveredBy: ['test B'], testsCompleted: 0 },
      ])

      const result = sut(report)

      expect(result).toBe('measured')
    })
  })

  describe('When no mutant is Killed or Timeout but one completed tests', () => {
    it('Then the verdict is measured', () => {
      const sut = classifyRun
      const report = buildReport([
        { status: 'Survived', coveredBy: ['test A'], testsCompleted: 3 },
        { status: 'Survived', coveredBy: ['test B'], testsCompleted: 0 },
      ])

      const result = sut(report)

      expect(result).toBe('measured')
    })
  })
})
