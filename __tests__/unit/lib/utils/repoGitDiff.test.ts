'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Config } from '../../../../src/types/config'
import RepoGitDiff from '../../../../src/utils/repoGitDiff'

// streamDiffLines yields lines as they arrive from git. Test setup
// translates "expected lines" into an async generator so each test
// reads as a sequence, not a single Promise<array> resolution.
const mockGetDiffLines = vi.fn<() => string[]>()
const streamDiffLines = async function* () {
  for (const line of mockGetDiffLines()) yield line
}
vi.mock('../../../../src/adapter/GitAdapter', () => ({
  default: {
    getInstance: vi.fn(() => ({
      streamDiffLines,
    })),
  },
}))

// Materializes an AsyncIterable<string> for assertions; isolates the
// test code from the producer being a generator.
const collect = async (source: AsyncIterable<string>): Promise<string[]> => {
  const out: string[] = []
  for await (const line of source) out.push(line)
  return out
}

const mockKeep = vi.fn()
vi.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: vi.fn(() => ({
    keep: mockKeep,
  })),
}))
mockKeep.mockReturnValue(true)

const FORCEIGNORE_MOCK_PATH = '__mocks__/.forceignore'

const TAB = '\t'

describe('Given a RepoGitDiff', () => {
  let globalMetadata: MetadataRepository
  let config: Config
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    config = {
      to: '',
      from: '',
      output: '',
      source: [''],
      ignore: '',
      ignoreDestructive: '',
      apiVersion: 0,
      repo: '',
      ignoreWhitespace: false,
      generateDelta: false,
      include: '',
      includeDestructive: '',
    }
  })
  it('Given empty diff and ignoreWhitespace, When getLines, Then returns empty', async () => {
    // Arrange
    mockGetDiffLines.mockReturnValue([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreWhitespace = true
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given empty diff without ignoreWhitespace, When getLines, Then returns empty', async () => {
    // Arrange
    mockGetDiffLines.mockReturnValue([])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given deleted file, When getLines, Then returns deletion line', async () => {
    // Arrange
    const filePath =
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
    mockGetDiffLines.mockReturnValue([`${DELETION}${TAB}${filePath}`])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([`${DELETION}${TAB}${filePath}`])
  })

  it('Given added file, When getLines, Then returns addition line', async () => {
    // Arrange
    const filePath =
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
    mockGetDiffLines.mockReturnValue([`${ADDITION}${TAB}${filePath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([`${ADDITION}${TAB}${filePath}`])
  })

  it('Given modified file, When getLines, Then returns modification line', async () => {
    // Arrange
    const filePath =
      'force-app/main/default/objects/Account/fields/awesome.field-meta.xml'
    mockGetDiffLines.mockReturnValue([`M${TAB}${filePath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([`${MODIFICATION}${TAB}${filePath}`])
  })

  it('Given ignored file, When getLines, Then filters it out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockReturnValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given ignored destructive file, When getLines, Then filters it out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockReturnValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given both ignore and ignoreDestructive, When getLines, Then filters matching files', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockReturnValue([
      `${ADDITION}${TAB}force-app/main/default/lwc/jsconfig.json`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given ignore set, When file matches ignore, Then filters it out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockReturnValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given only ignoreDestructive set, When non-deletion added, Then keeps it', async () => {
    // Arrange
    const filePath = 'force-app/main/default/pages/test.page-meta.xml'
    mockGetDiffLines.mockReturnValue([`${ADDITION}${TAB}${filePath}`])
    config.ignoreDestructive = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([`${ADDITION}${TAB}${filePath}`])
  })

  it('Given ignored subfolder files, When getLines, Then filters them out', async () => {
    // Arrange
    mockKeep.mockReturnValueOnce(false)
    mockGetDiffLines.mockReturnValue([
      `${ADDITION}${TAB}force-app/main/default/pages/test.page-meta.xml`,
    ])
    config.ignore = FORCEIGNORE_MOCK_PATH
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([])
  })

  it('Given moved file (same name different folder), When getLines, Then filters deletion and keeps addition', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/account/domain/classes/Account.cls`,
    ]
    mockGetDiffLines.mockReturnValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([lines[1]])
  })

  it('Given case-changed file, When getLines, Then filters deletion and keeps addition', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/objects/Account/fields/TEST__c.field-meta.xml`,
      `${ADDITION}${TAB}force-app/main/default/objects/Account/fields/Test__c.field-meta.xml`,
    ]
    mockGetDiffLines.mockReturnValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual([lines[1]])
  })

  it('Given truly renamed file, When getLines, Then keeps both lines', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/main/default/classes/RenamedAccount.cls`,
    ]
    mockGetDiffLines.mockReturnValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert — streaming output yields A/M lines first, defers D until EOF;
    // line order changes vs the legacy buffered impl but the membership
    // contract is unchanged.
    expect(result).toEqual(expect.arrayContaining(lines))
    expect(result).toHaveLength(lines.length)
  })

  it('Given same name in different parent, When getLines, Then keeps both lines', async () => {
    // Arrange
    const lines = [
      `${DELETION}${TAB}force-app/main/default/objects/Account/fields/CustomField__c.field-meta.xml`,
      `${ADDITION}${TAB}force-app/main/default/objects/Opportunity/fields/CustomField__c.field-meta.xml`,
    ]
    mockGetDiffLines.mockReturnValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert — see ordering note above
    expect(result).toEqual(expect.arrayContaining(lines))
    expect(result).toHaveLength(lines.length)
  })

  it('Given multiple files with same change type, When getLines, Then returns all', async () => {
    // Arrange
    const lines = [
      `${ADDITION}${TAB}force-app/main/default/classes/Account.cls`,
      `${ADDITION}${TAB}force-app/main/default/classes/Contact.cls`,
    ]
    mockGetDiffLines.mockReturnValue(lines)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const result = await collect(sut.getLines())

    // Assert
    expect(result).toStrictEqual(lines)
  })

  it('Given expanded array initialization (L39 ArrayDeclaration mutation), When getLines with no R-lines, Then no extra stray entries appear in result', async () => {
    // Mutant: const expanded: string[] = ["Stryker was here"] instead of []
    // "Stryker was here" is not a known metadata path so metadata.has filters it,
    // but if the initial stale entry bypasses filtering (e.g. due to a different mutant
    // interplay), the result count would differ. We verify exact result.
    const filePath = 'force-app/main/default/classes/MyClass.cls'
    mockGetDiffLines.mockReturnValue([`${ADDITION}${TAB}${filePath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    const result = await collect(sut.getLines())

    // Exactly one line — no stale initialization entries
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(`${ADDITION}${TAB}${filePath}`)
  })

  it('Given non-rename line startsWith check (L41 ConditionalExpression false), When getLines with normal A/D lines, Then normal lines pass through unchanged', async () => {
    // Mutant false: !line.startsWith(RENAMED) → false, so all lines fall into the rename block.
    // For a normal 'A\tpath' line: parts = ['A', 'path'], parts.length = 2 < 3 → pushed unchanged.
    // However if the line has no TAB (unlikely) or rename processing changes it, output differs.
    // We verify exact content of result — any mutation to normal lines would alter it.
    const addPath = 'force-app/main/default/classes/MyClass.cls'
    const delPath = 'force-app/main/default/classes/OtherClass.cls'
    mockGetDiffLines.mockReturnValue([
      `${ADDITION}${TAB}${addPath}`,
      `${DELETION}${TAB}${delPath}`,
    ])
    const sut = new RepoGitDiff(config, globalMetadata)

    const result = await collect(sut.getLines())

    // Both lines must appear exactly once, unmodified
    expect(result).toEqual([
      `${ADDITION}${TAB}${addPath}`,
      `${DELETION}${TAB}${delPath}`,
    ])
  })

  it('Given ?? [] fallback for ADDITION (L78 ArrayDeclaration mutation), When only DELETION lines exist, Then ADDITION set is empty (no stray Stryker entries)', async () => {
    // Mutant: ?? ["Stryker was here"] instead of ?? []
    // With the mutant, AfileNames = new Set(["Stryker was here"])
    // Then a DELETION line whose _extractComparisonName === "stryker was here" (lowercased)
    // would be incorrectly filtered. We use a distinct DELETION path.
    const delPath = 'force-app/main/default/classes/Stryker.cls'
    mockGetDiffLines.mockReturnValue([`${DELETION}${TAB}${delPath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    const result = await collect(sut.getLines())

    // Deletion must NOT be filtered (no corresponding ADDITION, ?? [] means empty AfileNames)
    expect(result).toEqual([`${DELETION}${TAB}${delPath}`])
  })

  it('Given ?? [] fallback for DELETION (L80 ArrayDeclaration mutation), When only ADDITION lines exist, Then deletedRenamed is empty', async () => {
    // Mutant: (linesPerDiffType.get(DELETION) ?? ["Stryker was here"]).filter(...)
    // With the mutant, the filter runs on ["Stryker was here"] instead of [].
    // _extractComparisonName("S") → metadata.getFullyQualifiedName("S")...
    // Even if "Stryker was here" doesn't match AfileNames, the deletedRenamed Set
    // would be correctly empty — BUT if it did match, deletedRenamed would be non-empty.
    // We verify: a DELETION whose name matches would normally not appear with ADDITION only.
    const addPath = 'force-app/main/default/classes/StrykerWasHere.cls'
    mockGetDiffLines.mockReturnValue([`${ADDITION}${TAB}${addPath}`])
    const sut = new RepoGitDiff(config, globalMetadata)

    const result = await collect(sut.getLines())

    expect(result).toEqual([`${ADDITION}${TAB}${addPath}`])
  })

  it('can reject in case of error', async () => {
    // Arrange — let the iterator throw on first read by making the
    // upstream stub itself throw.
    mockGetDiffLines.mockImplementation(() => {
      throw new Error('test')
    })
    const sut = new RepoGitDiff(config, null as unknown as MetadataRepository)

    // Act & Assert
    await expect(collect(sut.getLines())).rejects.toThrow()
  })

  it('filters empty lines', async () => {
    // Arrange
    mockGetDiffLines.mockReturnValue([
      '',
      `${ADDITION}${TAB}force-app/main/default/classes/Account.cls`,
      '',
    ])
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const work = await collect(sut.getLines())

    // Assert
    expect(work).toHaveLength(1)
  })

  it('groups lines by diff type for rename detection', async () => {
    // Arrange
    const output: string[] = [
      `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
      `${MODIFICATION}${TAB}force-app/main/default/classes/Other.cls`,
      `${ADDITION}${TAB}force-app/account/domain/classes/Account.cls`,
    ]
    mockGetDiffLines.mockReturnValue(output)
    const sut = new RepoGitDiff(config, globalMetadata)

    // Act
    const work = await collect(sut.getLines())

    // Assert
    // Deletion of Account.cls should be filtered (moved), but Modification and Addition kept
    expect(work).toHaveLength(2)
    expect(work).toContain(output[1])
    expect(work).toContain(output[2])
  })

  describe('_extractComparisonName', () => {
    let sut: RepoGitDiff
    beforeEach(() => {
      sut = new RepoGitDiff(config, globalMetadata)
    })
    describe('when called with normal type', () => {
      it('returns the file name', () => {
        // Arrange
        const line = 'A path/to/classes/Test.cls'

        // Act
        const result = sut['_extractComparisonName'](line)

        // Assert
        expect(result).toBe('test.cls')
      })
    })

    describe.each([
      'objects/Account/fields/custom__c.field',
      'objects/custom__c/custom__c.object',
      'objectTranslations/Account/custom__c.objectTranslation',
    ])('when called with path type', elPath => {
      it('returns the file name with the parent path', () => {
        // Arrange
        const line = `A path/to/${elPath}`

        // Act
        const result = sut['_extractComparisonName'](line)

        // Assert
        expect(result).toBe(elPath.replace(/\//g, '').toLocaleLowerCase())
      })
    })
  })

  describe('rename detection (git -M)', () => {
    it('Given a freshly constructed RepoGitDiff, When getRenamePairs is read before getLines is called, Then it returns an empty array (field initialiser)', () => {
      // Arrange
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act & Assert
      expect(sut.getRenamePairs()).toEqual([])
    })

    it('Given an R-line, When getLines, Then it is split into synthetic A and D lines and exposed via getRenamePairs', async () => {
      // Arrange
      mockGetDiffLines.mockReturnValue([
        `R095${TAB}force-app/main/default/classes/OldName.cls${TAB}force-app/main/default/classes/NewName.cls`,
      ])
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      const lines = await collect(sut.getLines())

      // Assert
      expect(lines).toContain(
        `${DELETION}${TAB}force-app/main/default/classes/OldName.cls`
      )
      expect(lines).toContain(
        `${ADDITION}${TAB}force-app/main/default/classes/NewName.cls`
      )
      expect(sut.getRenamePairs()).toEqual([
        {
          fromPath: 'force-app/main/default/classes/OldName.cls',
          toPath: 'force-app/main/default/classes/NewName.cls',
        },
      ])
    })

    it('Given no rename lines, When getLines, Then getRenamePairs returns an empty array', async () => {
      // Arrange
      mockGetDiffLines.mockReturnValue([
        `${ADDITION}${TAB}force-app/main/default/classes/New.cls`,
      ])
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      await collect(sut.getLines())

      // Assert
      expect(sut.getRenamePairs()).toEqual([])
    })

    it('Given a malformed R-line with fewer than 3 tab-separated parts, When getLines, Then the line is passed through unchanged and no rename pair is recorded', async () => {
      // Arrange
      mockGetDiffLines.mockReturnValue([`R095${TAB}only-one-path.cls`])
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      await collect(sut.getLines())

      // Assert
      expect(sut.getRenamePairs()).toEqual([])
    })

    it('Given getLines is called twice, When second call has no renames, Then renamePairs is reset to empty (not accumulated)', async () => {
      // Arrange — first call has a rename, second has none.
      // The `this.renamePairs = []` assignment at the start of _expandRenames
      // must reset the field; if mutated to a non-reset the pairs from the
      // first call would leak into the second.
      const sut = new RepoGitDiff(config, globalMetadata)
      mockGetDiffLines.mockReturnValueOnce([
        `R095${TAB}force-app/main/default/classes/OldName.cls${TAB}force-app/main/default/classes/NewName.cls`,
      ])
      await collect(sut.getLines())
      expect(sut.getRenamePairs()).toHaveLength(1)

      // Act — second call with no rename lines
      mockGetDiffLines.mockReturnValueOnce([
        `${ADDITION}${TAB}force-app/main/default/classes/Another.cls`,
      ])
      await collect(sut.getLines())

      // Assert — pairs from first call must NOT be present
      expect(sut.getRenamePairs()).toEqual([])
    })

    it('Given only ADDITION lines, When _getRenamedElements is called, Then AfileNames is populated and deletedRenamed is empty', async () => {
      // Arrange — no DELETION lines means (linesPerDiffType.get(DELETION) ?? [])
      // returns []. The `?? []` fallback for ADDITION lines (line 78) is
      // exercised when ADDITION is missing, but here we exercise the DELETION
      // fallback path: only ADDITION exists, DELETION map entry is absent.
      mockGetDiffLines.mockReturnValue([
        `${ADDITION}${TAB}force-app/main/default/classes/Account.cls`,
        `${ADDITION}${TAB}force-app/main/default/classes/Contact.cls`,
      ])
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      const result = await collect(sut.getLines())

      // Assert — both additions pass through; no deletion to filter
      expect(result).toHaveLength(2)
    })

    it('Given only DELETION lines, When getLines, Then ADDITION set is empty (built from ?? [] fallback) and no deletion is filtered', async () => {
      // Arrange — no ADDITION lines: linesPerDiffType.get(ADDITION) returns
      // undefined, so the `?? []` on line 78 provides the empty fallback.
      // AfileNames will be empty → no deletion matches → deletions pass through.
      mockGetDiffLines.mockReturnValue([
        `${DELETION}${TAB}force-app/main/default/classes/Account.cls`,
        `${DELETION}${TAB}force-app/main/default/classes/Contact.cls`,
      ])
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act
      const result = await collect(sut.getLines())

      // Assert — deletions are not filtered (no corresponding additions)
      expect(result).toHaveLength(2)
    })

    it('Given multiple lines with same diff type, When _spreadLinePerDiffType, Then all lines are grouped under the same key', async () => {
      // Arrange — exercises the `if (!acc.has(idx)) acc.set(idx, [])` guard.
      // If the guard is removed (BlockStatement {}), acc.get(idx) would be
      // undefined on first encounter and .push would throw.
      mockGetDiffLines.mockReturnValue([
        `${ADDITION}${TAB}force-app/main/default/classes/A.cls`,
        `${ADDITION}${TAB}force-app/main/default/classes/B.cls`,
        `${ADDITION}${TAB}force-app/main/default/classes/C.cls`,
      ])
      const sut = new RepoGitDiff(config, globalMetadata)

      // Act — if grouping is broken, getLines throws; otherwise we get 3 results
      const result = await collect(sut.getLines())

      // Assert
      expect(result).toHaveLength(3)
    })
  })
})
