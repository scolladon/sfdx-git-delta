'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { comparisonName } from '../../../../src/utils/comparisonName'
import {
  buildUnionSpec,
  isLabelsContainer,
  LABELS_UNION_SCOPE,
  type UnionSpecInput,
  unionScopeOf,
} from '../../../../src/utils/containerUnion'
import { SfdxProject } from '../../../../src/utils/sfdxProject'

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
      blobIds: new Map(paths.map(path => [path, 'id'])),
    })

    const specOf = (overrides: Partial<UnionSpecInput> = {}) =>
      buildUnionSpec({
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
      })

    it('When labels sit in two directories of one entry, Then both are bases and shields and other entries and out-of-source files are excluded', () => {
      // Act
      const result = specOf()

      // Assert
      expect(result).toEqual({
        entry: ENTRY,
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

    it('When a from file is ignored for deletions, Then it leaves the bases', () => {
      // Act
      const result = specOf({
        ignore: { keep: line => line !== `D\t${IN_A}` },
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

    it('When a D line targets a base file, Then it is dropped; a D line of a non-base file is not', () => {
      // Act
      const result = specOf({
        lines: [`D\t${IN_A}`, `D\t${IN_OTHER_ENTRY}`],
      })

      // Assert
      expect(result.droppedDeletions).toEqual([`D\t${IN_A}`])
    })

    it('When the scope is a workflow, Then candidates come from the listing roots under that cancellation key', () => {
      // Arrange
      const mine = 'force-app/a/workflows/Account.workflow-meta.xml'
      const sibling = 'force-app/a/workflows/Lead.workflow-meta.xml'
      const elsewhere = 'force-app/a/other/Account.workflow-meta.xml'
      const scope = unionScopeOf(mine, metadata)

      // Act
      const result = specOf({
        scope,
        listingRoots: ['force-app/a/workflows'],
        from: sideOf([mine, sibling, elsewhere]),
        to: sideOf([mine, sibling]),
      })

      // Assert
      expect(result.additionBasePaths).toEqual([mine])
      expect(result.shieldPaths).toEqual([mine])
    })
  })
})
