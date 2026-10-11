'use strict'
import { ObjectId } from '@scolladon/tsgit'
import { beforeAll, describe, expect, it } from 'vitest'

import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { comparisonName } from '../../../../src/utils/comparisonName'
import {
  buildUnionSpec,
  isLabelsContainer,
  LABELS_UNION_SCOPE,
  listUnionCandidates,
  type UnionSpecInput,
  unionScopeOf,
} from '../../../../src/utils/containerUnion'
import { SfdxProject } from '../../../../src/utils/sfdxProject'

const OBJECT_ID = ObjectId.from('a'.repeat(40))
const LABELS = 'force-app/a/labels/CustomLabels.labels-meta.xml'
const OTHER_LABELS = 'force-app/b/labels/Other.labels-meta.xml'
const DECOMPOSED = 'force-app/a/labels/D1.label-meta.xml'
const WORKFLOW = 'force-app/a/workflows/Account.workflow-meta.xml'
const CLASS = 'force-app/a/classes/Foo.cls'

describe('Given containerUnion path rules', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  describe('isLabelsContainer', () => {
    it.each([
      ['a labels file', LABELS, true],
      ['a labels file with another name', OTHER_LABELS, true],
      ['a decomposed label', DECOMPOSED, false],
      ['a workflow', WORKFLOW, false],
      ['a class', CLASS, false],
      [
        'a labels-named file of no known type',
        'force-app/a/misc/Unknown.labels-meta.xml',
        false,
      ],
    ])(
      'When the path is %s, Then the answer is %s',
      (_title, path, expected) => {
        // Act
        const result = isLabelsContainer(path, metadata)

        // Assert
        expect(result).toBe(expected)
      }
    )
  })

  describe('unionScopeOf', () => {
    it.each([LABELS, OTHER_LABELS])(
      'When the path is the labels file %s, Then the scope is the type-wide one',
      path => {
        // Act
        const result = unionScopeOf(path, metadata)

        // Assert
        expect(result).toBe(LABELS_UNION_SCOPE)
      }
    )

    it.each([DECOMPOSED, WORKFLOW])(
      'When the path is %s, Then the scope is its own cancellation key',
      path => {
        // Arrange
        const expected = comparisonName(metadata, `A\t${path}`)

        // Act
        const result = unionScopeOf(path, metadata)

        // Assert
        expect(result).toBe(expected)
      }
    )
  })

  describe('buildUnionSpec', () => {
    const PROJECT = SfdxProject.parse(
      JSON.stringify({
        packageDirectories: [{ path: 'force-app' }, { path: 'other-app' }],
      })
    )
    const ENTRY = 'force-app'
    const IN_A = 'force-app/a/labels/CustomLabels.labels-meta.xml'
    const IN_B = 'force-app/b/labels/Other.labels-meta.xml'
    const IN_OTHER_ENTRY = 'other-app/x/labels/CustomLabels.labels-meta.xml'
    const OUT_OF_SOURCE = 'force-app/z/labels/CustomLabels.labels-meta.xml'
    const SOURCE = ['force-app/a', 'force-app/b', 'other-app']
    const sideOf = (paths: readonly string[]) => ({
      project: PROJECT,
      blobIds: new Map(paths.map(path => [path, OBJECT_ID])),
    })

    const specOf = (overrides: Partial<UnionSpecInput> = {}) => {
      const input: UnionSpecInput = {
        scope: LABELS_UNION_SCOPE,
        entry: ENTRY,
        listingRoots: [],
        metadata,
        source: SOURCE,
        ignore: { keep: () => true },
        from: sideOf([IN_A, IN_B, IN_OTHER_ENTRY, OUT_OF_SOURCE, CLASS]),
        to: sideOf([IN_A, IN_B, IN_OTHER_ENTRY, OUT_OF_SOURCE]),
        lines: [],
        ...overrides,
      }
      return buildUnionSpec(input, listUnionCandidates(input, [input]))
    }

    it('When labels sit in two directories of one entry, Then both are bases and shields and other entries and out-of-source files are excluded', () => {
      // Act
      const result = specOf()

      // Assert
      expect(result).toEqual({
        additionBasePaths: [IN_A, IN_B],
        deletionBasePaths: [IN_A, IN_B],
        shieldPaths: [IN_A, IN_B],
        memberPaths: [],
        droppedDeletions: [],
      })
    })

    it('When a from file is ignored for additions, Then it leaves the bases', () => {
      // Act
      const result = specOf({
        ignore: { keep: line => line !== `A\t${IN_A}` },
      })

      // Assert
      expect(result.additionBasePaths).toEqual([IN_B])
      expect(result.deletionBasePaths).toEqual([IN_B])
    })

    it.each([
      ['present at --to and kept for deletions', true, true, true, true],
      ['present at --to and ignored for deletions', true, false, true, false],
      ['deleted and kept for deletions', false, true, true, true],
      ['deleted and ignored for deletions', false, false, false, false],
    ])(
      'When a from file is %s, Then in the addition base: %s, in the deletion base: %s, deletion within addition',
      (_title, present, keptForDeletion, inAddition, inDeletion) => {
        // Arrange
        const to = sideOf(present ? [IN_A, IN_B] : [IN_B])

        // Act
        const result = specOf({
          to,
          ignore: {
            keep: line => keptForDeletion || line !== `D\t${IN_A}`,
          },
        })

        // Assert
        expect(result.additionBasePaths.includes(IN_A)).toBe(inAddition)
        expect(result.deletionBasePaths.includes(IN_A)).toBe(inDeletion)
        expect(
          result.deletionBasePaths.every(path =>
            result.additionBasePaths.includes(path)
          )
        ).toBe(true)
      }
    )

    it('When an unchanged from file sits in another package directory at --to, Then it joins neither base', () => {
      // Arrange
      const movedEntries = SfdxProject.parse(
        JSON.stringify({
          packageDirectories: [{ path: 'force-app/a' }, { path: 'force-app' }],
        })
      )

      // Act
      const result = specOf({
        to: { ...sideOf([IN_A, IN_B]), project: movedEntries },
      })

      // Assert
      expect(result.additionBasePaths).toEqual([IN_B])
      expect(result.deletionBasePaths).toEqual([IN_B])
    })

    it('When a to file is ignored, Then it stays a shield but is no member', () => {
      // Act
      const result = specOf({
        ignore: { keep: line => line !== `A\t${IN_B}` },
        lines: [`A\t${IN_A}`, `A\t${IN_B}`],
      })

      // Assert
      expect(result.shieldPaths).toEqual([IN_A, IN_B])
      expect(result.memberPaths).toEqual([IN_A, IN_B])
    })

    it('When lines carry an M and an A line, Then both paths are members', () => {
      // Act
      const result = specOf({ lines: [`M\t${IN_A}`, `A\t${IN_B}`] })

      // Assert
      expect(result.memberPaths).toEqual([IN_A, IN_B])
    })

    it('When candidates are read from unordered listings, Then bases and shields come out in path order', () => {
      // Act
      const result = specOf({
        from: sideOf([IN_B, IN_A]),
        to: sideOf([IN_B, IN_A]),
      })

      // Assert
      expect(result.additionBasePaths).toEqual([IN_A, IN_B])
      expect(result.shieldPaths).toEqual([IN_A, IN_B])
    })

    it('When a D line names a file still present at --to, Then it is no member', () => {
      // Act
      const result = specOf({ lines: [`D\t${IN_A}`, `A\t${IN_B}`] })

      // Assert
      expect(result.memberPaths).toEqual([IN_B])
    })

    it('When a D line targets a base file, Then it is dropped; a D line of a non-base file is not', () => {
      // Act
      const result = specOf({
        lines: [`D\t${IN_A}`, `D\t${IN_OTHER_ENTRY}`],
      })

      // Assert
      expect(result.droppedDeletions).toEqual([`D\t${IN_A}`])
    })

    it('When a base file also carries an M line, Then only its D lines are dropped', () => {
      // Act
      const result = specOf({ lines: [`M\t${IN_A}`, `D\t${IN_B}`] })

      // Assert
      expect(result.droppedDeletions).toEqual([`D\t${IN_B}`])
    })

    it('When several D lines target base files, Then they are dropped in the order of the input lines', () => {
      // Arrange
      const lines = [`D\t${IN_B}`, `D\t${IN_A}`]

      // Act
      const result = specOf({ lines })

      // Assert
      expect(result.droppedDeletions).toEqual(lines)
    })

    it('When a labels-named file is unknown to the metadata, Then it is no candidate', () => {
      // Arrange
      const unknown = 'force-app/a/misc/Unknown.labels-meta.xml'

      // Act
      const result = specOf({ from: sideOf([unknown]), to: sideOf([unknown]) })

      // Assert
      expect(result.shieldPaths).toEqual([])
      expect(result.additionBasePaths).toEqual([])
    })

    it.each([
      ['no file of the scope', []],
      ['no file in the entry', [IN_A]],
    ])(
      'When the listing holds %s for the entry, Then the spec is empty',
      (_title, paths) => {
        // Act
        const result = specOf({
          entry: 'other-app',
          from: sideOf(paths),
          to: sideOf(paths),
        })

        // Assert
        expect(result.shieldPaths).toEqual([])
        expect(result.additionBasePaths).toEqual([])
      }
    )

    it('When a file sits outside the listing roots of every target, Then it is not listed', () => {
      // Arrange
      const input: UnionSpecInput = {
        scope: LABELS_UNION_SCOPE,
        entry: ENTRY,
        listingRoots: [],
        metadata,
        source: SOURCE,
        ignore: { keep: () => true },
        from: sideOf([IN_A, CLASS]),
        to: sideOf([IN_A, CLASS]),
        lines: [],
      }

      // Act
      const listing = listUnionCandidates(input, [input])

      // Assert
      expect([...listing.from.keys()]).toEqual([LABELS_UNION_SCOPE])
      expect([...listing.to.keys()]).toEqual([LABELS_UNION_SCOPE])
    })

    it('When the scope is a workflow, Then candidates come from the listing roots of the spec under that cancellation key', () => {
      // Arrange
      const mine = 'force-app/a/workflows/Account.workflow-meta.xml'
      const sibling = 'force-app/a/workflows/Lead.workflow-meta.xml'
      const inOtherRoots = 'force-app/b/workflows/Account.workflow-meta.xml'
      const scope = unionScopeOf(mine, metadata)
      const input: UnionSpecInput = {
        scope,
        entry: ENTRY,
        listingRoots: ['force-app/a/workflows'],
        metadata,
        source: SOURCE,
        ignore: { keep: () => true },
        from: sideOf([mine, sibling, inOtherRoots]),
        to: sideOf([mine, sibling, inOtherRoots]),
        lines: [],
      }
      const listing = listUnionCandidates(input, [
        input,
        { scope, listingRoots: ['force-app/b/workflows'] },
      ])

      // Act
      const result = buildUnionSpec(input, listing)

      // Assert
      expect(result.additionBasePaths).toEqual([mine])
      expect(result.shieldPaths).toEqual([mine])
    })
  })
})
