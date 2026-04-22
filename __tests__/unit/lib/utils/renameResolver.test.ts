'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/utils/LoggingService')

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { ChangeKind } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import ChangeSet from '../../../../src/utils/changeSet'
import { Logger } from '../../../../src/utils/LoggingService'
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
    it('When apply runs, Then a rename is recorded on the ChangeSet and getTypeHandler is invoked with D/A-prefixed synthetic lines carrying the full paths', async () => {
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

      // Assert — rename recorded on the ChangeSet (type/from/to flow through
      // as an observable outcome; a mutation swapping any of the three args
      // to recordRename surfaces here without spying on the collaborator).
      const renameMap = changes
        .byChangeKind()
        [ChangeKind.Rename].get('ApexClass')!
      expect([...renameMap.values()]).toEqual([{ from: 'Old', to: 'New' }])
      // Assert — synthetic lines pass the full paths through to handler
      // resolution. getTypeHandler is a genuine boundary (it's mocked at the
      // module level), so pinning its call args is the only observable
      // channel for the D/A prefix template — the path strings have no other
      // downstream echo in this test.
      expect(mockGetTypeHandler).toHaveBeenNthCalledWith(1, 'D\told/path.cls')
      expect(mockGetTypeHandler).toHaveBeenNthCalledWith(2, 'A\tnew/path.cls')
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

      // Assert — observable outcome: the rename bucket stays empty. The
      // resolver's `from.member === to.member` guard and ChangeSet's own
      // `from===to` short-circuit are both defence-in-depth for this case;
      // removing either in isolation is an equivalent mutant (the other
      // still produces the same observable). We accept that residual.
      expect(changes.byChangeKind()[ChangeKind.Rename].size).toBe(0)
    })
  })

  describe('Given a rename pair where from and to resolve to different metadata types', () => {
    it('When apply runs, Then no rename is recorded', async () => {
      // Arrange — members differ too so the type-mismatch guard is the only
      // branch that can skip this pair (ChangeSet has no type-mismatch
      // guard, so removing the resolver's guard would record a rename
      // under from.type with mismatched to.member — caught by the bucket
      // assertion below).
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexTrigger', member: 'Bar' }),
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
    it('When apply runs, Then the pair is skipped and a warning is logged', async () => {
      // Arrange
      const loggerWarn = vi.spyOn(Logger, 'warn')
      mockGetTypeHandler.mockRejectedValueOnce(
        new Error('Unknown metadata type for path: ignored/path')
      )
      const changes = new ChangeSet()
      const sut = new RenameResolver(work, metadata)

      // Act & Assert — apply resolves without throwing
      await expect(
        sut.apply(changes, [
          { fromPath: 'ignored/path', toPath: 'other/path.cls' },
        ])
      ).resolves.toBeUndefined()
      expect(changes.byChangeKind()[ChangeKind.Rename].size).toBe(0)
      // Logger.warn is a genuine boundary (module-mocked); asserting the
      // call is the observable channel for the catch block's side effect.
      // Emptying the catch block would swallow the error silently.
      expect(loggerWarn).toHaveBeenCalledOnce()
    })
  })
})
