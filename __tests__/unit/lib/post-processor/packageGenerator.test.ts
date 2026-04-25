'use strict'
import { PassThrough } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import PackageGenerator from '../../../../src/post-processor/packageGenerator'
import { ChangeKind } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

const {
  mockBuildPackageStream,
  mockCreateWriteStream,
  mockMkdir,
  writtenPaths,
} = vi.hoisted(() => ({
  mockBuildPackageStream: vi.fn<() => Promise<void>>(),
  mockCreateWriteStream: vi.fn(),
  mockMkdir: vi.fn<() => Promise<void>>(),
  writtenPaths: [] as string[],
}))

vi.mock('node:fs', async () => {
  const actual: typeof import('node:fs') = await vi.importActual('node:fs')
  return {
    ...actual,
    createWriteStream: mockCreateWriteStream,
    promises: {
      ...actual.promises,
      mkdir: mockMkdir,
    },
  }
})

vi.mock('../../../../src/utils/packageHelper', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { buildPackageStream: mockBuildPackageStream }
    }),
  }
})

beforeEach(() => {
  writtenPaths.length = 0
  mockBuildPackageStream.mockResolvedValue()
  mockMkdir.mockResolvedValue()
  mockCreateWriteStream.mockImplementation((path: string) => {
    writtenPaths.push(path)
    return new PassThrough()
  })
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
      expect(new Set(writtenPaths)).toEqual(
        new Set([
          'test/destructiveChanges/destructiveChanges.xml',
          'test/package/package.xml',
          'test/destructiveChanges/package.xml',
        ])
      )
    })

    it('When process runs, Then mkdir is called with recursive: true for each write (kills L54 ObjectLiteral {} and BooleanLiteral false)', async () => {
      // Arrange
      const sut = new PackageGenerator(work, metadata)

      // Act
      await sut.process()

      // Assert — three WriteOps → three mkdir calls, each must pass recursive: true
      expect(mockMkdir).toHaveBeenCalledTimes(3)
      for (const call of mockMkdir.mock.calls) {
        expect(call[1]).toEqual({ recursive: true })
      }
    })

    it('When process runs, Then buildPackageStream is called three times with distinct manifests (kills L54:42 ObjectLiteral {} for empty Map)', async () => {
      // Arrange
      work.changes.add(ChangeKind.Add, 'ApexClass', 'Foo')
      work.changes.add(ChangeKind.Delete, 'ApexClass', 'Bar')
      const sut = new PackageGenerator(work, metadata)

      // Act
      await sut.process()

      // Assert — three calls: destructive manifest, package manifest, empty Map
      expect(mockBuildPackageStream).toHaveBeenCalledTimes(3)
      // Third call uses an empty Map (the companion package.xml in destructive folder)
      const thirdCallManifest = mockBuildPackageStream.mock.calls[2]![0]
      expect(thirdCallManifest).toBeInstanceOf(Map)
      expect((thirdCallManifest as Map<string, Set<string>>).size).toBe(0)
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
