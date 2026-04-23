'use strict'
import { outputFile } from 'fs-extra'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import PackageGenerator from '../../../../src/post-processor/packageGenerator'
import { ChangeKind } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

const { mockBuildPackage } = vi.hoisted(() => ({
  mockBuildPackage: vi.fn(),
}))

vi.mock('fs-extra')

vi.mock('../../../../src/utils/packageHelper', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { buildPackage: mockBuildPackage }
    }),
  }
})

describe('PackageGenerator', () => {
  let work: Work
  let metadata: MetadataRepository
  beforeEach(async () => {
    work = getWork()
    metadata = await getDefinition({})
    work.config.output = 'test'
  })

  describe('process', () => {
    it('writes destructiveChanges.xml, package.xml, and the empty destructive package.xml', async () => {
      // Arrange
      work.changes.add(ChangeKind.Add, 'ApexClass', 'Foo')
      const sut = new PackageGenerator(work, metadata)

      // Act
      await sut.process()

      // Assert
      const writes = vi
        .mocked(outputFile)
        .mock.calls.map(call => call[0] as string)
      expect(new Set(writes)).toEqual(
        new Set([
          'test/destructiveChanges/destructiveChanges.xml',
          'test/package/package.xml',
          'test/destructiveChanges/package.xml',
        ])
      )
    })

    describe.each([
      {
        label: 'disjoint add and delete sets',
        add: [['a', 'a'] as const],
        del: [['d', 'a'] as const],
        expectedDestructive: new Map([['d', new Set(['a'])]]),
      },
      {
        label: 'full cancellation (add covers every delete)',
        add: [['a', 'a'] as const],
        del: [['a', 'a'] as const],
        expectedDestructive: new Map(),
      },
      {
        label: 'partial cancellation (add covers some deletes)',
        add: [['a', 'a'] as const],
        del: [['a', 'a'] as const, ['a', 'b'] as const],
        expectedDestructive: new Map([['a', new Set(['b'])]]),
      },
    ])('Given $label', ({ add, del, expectedDestructive }) => {
      it('When process runs, Then the destructive view drops cancelled deletions', async () => {
        // Arrange
        for (const [type, member] of add) {
          work.changes.add(ChangeKind.Add, type, member)
        }
        for (const [type, member] of del) {
          work.changes.add(ChangeKind.Delete, type, member)
        }
        const sut = new PackageGenerator(work, metadata)

        // Act
        await sut.process()

        // Assert
        expect(work.changes.forDestructiveManifest()).toEqual(
          expectedDestructive
        )
      })
    })
  })
})
