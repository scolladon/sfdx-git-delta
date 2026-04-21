'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/utils/LoggingService')

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { ChangeKind } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import ChangeSet from '../../../../src/utils/changeSet'
import RenameResolver from '../../../../src/utils/renameResolver'
import { getWork } from '../../../__utils__/testWork'

const mockGetTypeHandler = vi.fn()
vi.mock('../../../../src/service/typeHandlerFactory', () => ({
  default: vi.fn().mockImplementation(function () {
    return { getTypeHandler: mockGetTypeHandler }
  }),
}))

describe('RenameResolver', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeEach(async () => {
    work = getWork()
    metadata = await getDefinition({})
    mockGetTypeHandler.mockReset()
  })

  describe('Given a rename pair where both sides resolve to the same type but different members', () => {
    it('When apply runs, Then a rename is recorded on the ChangeSet', async () => {
      // Arrange
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Old' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'New' }),
        })
      const changes = new ChangeSet()
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [
        { fromPath: 'old/path.cls', toPath: 'new/path.cls' },
      ])

      // Assert
      const renameMap = changes
        .byChangeKind()
        [ChangeKind.Rename].get('ApexClass')!
      expect([...renameMap.values()]).toEqual([{ from: 'Old', to: 'New' }])
    })
  })

  describe('Given a rename pair where both sides resolve to the same type and same member (e.g. bundle helper file)', () => {
    it('When apply runs, Then no rename is recorded', async () => {
      // Arrange
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({
            type: 'LightningComponentBundle',
            member: 'myBundle',
          }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({
            type: 'LightningComponentBundle',
            member: 'myBundle',
          }),
        })
      const changes = new ChangeSet()
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [
        {
          fromPath: 'lwc/myBundle/helper.js',
          toPath: 'lwc/newBundle/helper.js',
        },
      ])

      // Assert
      expect(changes.byChangeKind()[ChangeKind.Rename].size).toBe(0)
    })
  })

  describe('Given a rename pair where from and to resolve to different metadata types', () => {
    it('When apply runs, Then the pair is skipped (not a real rename)', async () => {
      // Arrange
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexTrigger', member: 'Foo' }),
        })
      const changes = new ChangeSet()
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [{ fromPath: 'old.cls', toPath: 'new.trigger' }])

      // Assert
      expect(changes.byChangeKind()[ChangeKind.Rename].size).toBe(0)
    })
  })

  describe('Given a rename pair where getTypeHandler throws (ignored path)', () => {
    it('When apply runs, Then the pair is silently skipped', async () => {
      // Arrange
      mockGetTypeHandler.mockRejectedValueOnce(
        new Error('Unknown metadata type for path: ignored/path')
      )
      const changes = new ChangeSet()
      const sut = new RenameResolver(work, metadata)

      // Act & Assert
      await expect(
        sut.apply(changes, [
          { fromPath: 'ignored/path', toPath: 'other/path.cls' },
        ])
      ).resolves.toBeUndefined()
      expect(changes.byChangeKind()[ChangeKind.Rename].size).toBe(0)
    })
  })
})
