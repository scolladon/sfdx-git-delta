'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/utils/LoggingService')

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type { Config } from '../../../../src/types/config'
import { Logger } from '../../../../src/utils/LoggingService'
import RenameResolver from '../../../../src/utils/renameResolver'
import { getConfig, getContext } from '../../../__utils__/testWork'

const mockGetTypeHandler = vi.fn()
vi.mock('../../../../src/service/typeHandlerFactory', () => ({
  default: vi.fn().mockImplementation(function () {
    return { getTypeHandler: mockGetTypeHandler }
  }),
}))

describe('RenameResolver', () => {
  let config: Config
  let metadata: MetadataRepository

  beforeEach(async () => {
    config = getConfig()
    metadata = await getDefinition({})
    mockGetTypeHandler.mockReset()
  })

  describe('Given a rename pair where both sides resolve to the same type but different members', () => {
    it('When resolve runs, Then a rename triple is returned and getTypeHandler is invoked with D/A-prefixed synthetic lines carrying the full paths', async () => {
      // Arrange
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Old' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'New' }),
        })
      const sut = new RenameResolver(getContext({ config, metadata }))

      // Act
      const triples = await sut.resolve([
        { fromPath: 'old/path.cls', toPath: 'new/path.cls' },
      ])

      // Assert — the resolved triple is returned directly (type/from/to flow
      // through as an observable outcome; a mutation swapping any of the
      // three fields surfaces here without spying on a collaborator).
      expect(triples).toEqual([{ type: 'ApexClass', from: 'Old', to: 'New' }])
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
    it('When resolve runs, Then no triple is returned', async () => {
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
      const sut = new RenameResolver(getContext({ config, metadata }))

      // Act
      const triples = await sut.resolve([
        {
          fromPath: 'lwc/myBundle/helper.js',
          toPath: 'lwc/newBundle/helper.js',
        },
      ])

      // Assert — observable outcome: the returned array stays empty. The
      // resolver's `from.member === to.member` guard and ChangeSet's own
      // `from===to` short-circuit are both defence-in-depth for this case;
      // removing either in isolation is an equivalent mutant (the other
      // still produces the same observable). We accept that residual.
      expect(triples).toEqual([])
    })
  })

  describe('Given a rename pair where from and to resolve to different metadata types', () => {
    it('When resolve runs, Then no triple is returned', async () => {
      // Arrange — members differ too so the type-mismatch guard is the only
      // branch that can skip this pair (ChangeSet has no type-mismatch
      // guard, so removing the resolver's guard would return a triple
      // under from.type with mismatched to.member — caught by the assertion
      // below).
      mockGetTypeHandler
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexClass', member: 'Foo' }),
        })
        .mockResolvedValueOnce({
          getElementDescriptor: () => ({ type: 'ApexTrigger', member: 'Bar' }),
        })
      const sut = new RenameResolver(getContext({ config, metadata }))

      // Act
      const triples = await sut.resolve([
        { fromPath: 'old.cls', toPath: 'new.trigger' },
      ])

      // Assert
      expect(triples).toEqual([])
    })
  })

  describe('Given a rename pair where getTypeHandler throws (ignored path)', () => {
    it('When resolve runs, Then the pair is skipped and a warning is logged', async () => {
      // Arrange
      const loggerWarn = vi.spyOn(Logger, 'warn')
      mockGetTypeHandler.mockRejectedValueOnce(
        new Error('Unknown metadata type for path: ignored/path')
      )
      const sut = new RenameResolver(getContext({ config, metadata }))

      // Act & Assert — resolve settles without throwing
      await expect(
        sut.resolve([{ fromPath: 'ignored/path', toPath: 'other/path.cls' }])
      ).resolves.toEqual([])
      // Logger.warn is a genuine boundary (module-mocked); asserting the
      // call is the observable channel for the catch block's side effect.
      // Emptying the catch block would swallow the error silently.
      expect(loggerWarn).toHaveBeenCalledOnce()
    })
  })
})
