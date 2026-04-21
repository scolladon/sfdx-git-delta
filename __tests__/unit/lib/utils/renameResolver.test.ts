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
      const recordRename = vi.spyOn(changes, 'recordRename')
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [
        { fromPath: 'old/path.cls', toPath: 'new/path.cls' },
      ])

      // Assert — rename recorded on the ChangeSet
      const renameMap = changes
        .byChangeKind()
        [ChangeKind.Rename].get('ApexClass')!
      expect([...renameMap.values()]).toEqual([{ from: 'Old', to: 'New' }])
      expect(recordRename).toHaveBeenCalledExactlyOnceWith(
        'ApexClass',
        'Old',
        'New'
      )
      // Assert — synthetic lines pass the full paths through to handler
      // resolution (catches template-literal/string-mutation regressions).
      expect(mockGetTypeHandler).toHaveBeenNthCalledWith(1, 'D\told/path.cls')
      expect(mockGetTypeHandler).toHaveBeenNthCalledWith(2, 'A\tnew/path.cls')
    })
  })

  describe('Given a rename pair where both sides resolve to the same type and same member (e.g. bundle helper file)', () => {
    it('When apply runs, Then recordRename is never called', async () => {
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
      const recordRename = vi.spyOn(changes, 'recordRename')
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [
        {
          fromPath: 'lwc/myBundle/helper.js',
          toPath: 'lwc/newBundle/helper.js',
        },
      ])

      // Assert — recordRename must not be called at all. (An earlier test
      // asserted the rename bucket stayed empty, but ChangeSet.recordRename
      // has its own from===to short-circuit which masked a mutation in the
      // resolver's same-member check. Spying on recordRename pins the
      // resolver-level skip as the observable behaviour.)
      expect(recordRename).not.toHaveBeenCalled()
    })
  })

  describe('Given a rename pair where from and to resolve to different metadata types BUT share the same member name', () => {
    it('When apply runs, Then recordRename is not called (type mismatch skip takes precedence over same-member skip)', async () => {
      // Arrange — isolate the type-mismatch branch: without it, the resolver
      // would happily forward a (ApexClass, Foo → Foo) record which the
      // same-member branch would in turn reject — the spy lets us distinguish
      // which guard actually fired.
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexTrigger', member: 'Bar' }),
        })
      const changes = new ChangeSet()
      const recordRename = vi.spyOn(changes, 'recordRename')
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [{ fromPath: 'old.cls', toPath: 'new.trigger' }])

      // Assert
      expect(recordRename).not.toHaveBeenCalled()
    })
  })

  describe('Given a rename pair where both sides resolve to the same type and same member BUT types also match', () => {
    it('When apply runs, Then recordRename is not called (same-member skip fires)', async () => {
      // Arrange — types match, members match. Isolates the same-member
      // branch. Without the member === member guard in _resolve, the resolver
      // would return a record and ChangeSet.recordRename (with its own
      // from===to short-circuit) would still discard it — but we care that
      // the resolver's branch fired, not the downstream guard.
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
      const changes = new ChangeSet()
      const recordRename = vi.spyOn(changes, 'recordRename')
      const sut = new RenameResolver(work, metadata)

      // Act
      await sut.apply(changes, [{ fromPath: 'a.cls', toPath: 'a-renamed.cls' }])

      // Assert
      expect(recordRename).not.toHaveBeenCalled()
    })
  })

  describe('Given a rename pair where getTypeHandler throws (ignored path)', () => {
    it('When apply runs, Then the pair is skipped and a warning is logged (confirms the catch block still runs the log statement)', async () => {
      // Arrange
      const loggerWarn = vi.spyOn(Logger, 'warn')
      mockGetTypeHandler.mockRejectedValueOnce(
        new Error('Unknown metadata type for path: ignored/path')
      )
      const changes = new ChangeSet()
      const recordRename = vi.spyOn(changes, 'recordRename')
      const sut = new RenameResolver(work, metadata)

      // Act & Assert — apply resolves without throwing
      await expect(
        sut.apply(changes, [
          { fromPath: 'ignored/path', toPath: 'other/path.cls' },
        ])
      ).resolves.toBeUndefined()
      expect(recordRename).not.toHaveBeenCalled()
      // Catch-block presence is the observable effect — emptying it would
      // swallow the error silently, which this assertion rejects.
      expect(loggerWarn).toHaveBeenCalledOnce()
    })
  })
})
