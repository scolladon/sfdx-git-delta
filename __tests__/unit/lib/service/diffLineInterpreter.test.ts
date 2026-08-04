'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import TypeHandlerFactory from '../../../../src/service/typeHandlerFactory'
import type { Config } from '../../../../src/types/config'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import {
  ChangeKind,
  emptyResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import ChangeSet from '../../../../src/utils/changeSet'
import { getConfig } from '../../../__utils__/testWork'

// `collect(sink?)` writes manifest entries directly into the sink the
// interpreter passes in. We hoist a mock that accepts the sink, mirrors
// the production contract by addElement-ing into it, and returns the
// recorded result for the test's outer assertions.
const { mockCollect } = vi.hoisted(() => ({
  mockCollect:
    vi.fn<
      (
        sink?: import('../../../../src/utils/changeSet').default
      ) => Promise<import('../../../../src/types/handlerResult').HandlerResult>
    >(),
}))

vi.mock('../../../../src/service/typeHandlerFactory', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        getTypeHandler: vi
          .fn()
          .mockImplementation(async () => ({ collect: mockCollect })),
      }
    }),
  }
})

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  mockCollect.mockResolvedValue(emptyResult())
  config = getConfig()
})

describe('DiffLineInterpreter', () => {
  let sut: DiffLineInterpreter
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    sut = new DiffLineInterpreter(config, globalMetadata)
  })

  describe('when called with lines', () => {
    it('process each lines', async () => {
      // Arrange
      const lines = ['test']
      const manifest = {
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'Foo',
        changeKind: ChangeKind.Add as ChangeKind.Add,
      }
      mockCollect.mockImplementation(async sink => {
        sink?.addElement(manifest)
        return { changes: sink ?? new ChangeSet(), copies: [], warnings: [] }
      })

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(result.changes.toElements()).toEqual([manifest])
    })

    it('Given slow handlers, When queue workers finish after enqueuing, Then all results are collected', async () => {
      // Arrange — three lines, each handler returns a distinct manifest so
      // we can verify all three results landed (Set-based ChangeSet dedupes
      // identical entries, so the per-handler element must differ to
      // distinguish "all collected" from "one collected three times").
      const lines = ['a', 'b', 'c']
      let counter = 0
      mockCollect.mockImplementation(sink => {
        const seq = counter++
        return new Promise(resolve =>
          setImmediate(() => {
            sink?.addElement({
              target: ManifestTarget.Package,
              type: 'CustomLabel',
              member: `test${seq}`,
              changeKind: ChangeKind.Modify,
            })
            resolve({
              changes: sink ?? new ChangeSet(),
              copies: [],
              warnings: [],
            })
          })
        )
      })

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(3)
      expect(result.changes.toElements()).toHaveLength(3)
    })
  })

  describe('when called without lines', () => {
    it('it does not process anything and returns empty result', async () => {
      // Arrange
      const lines: string[] = []

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(mockCollect).not.toHaveBeenCalled()
      expect(result.changes.toElements()).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given revisions parameter', () => {
    it('When revisions are provided, Then uses them in effectiveWork', async () => {
      // Arrange
      const lines = ['test']
      const revisions = { from: 'sha1', to: 'sha2' }
      const manifest = {
        target: ManifestTarget.Package,
        type: 'ApexClass',
        member: 'Scoped',
        changeKind: ChangeKind.Add as ChangeKind.Add,
      }
      mockCollect.mockImplementation(async sink => {
        sink?.addElement(manifest)
        return { changes: sink ?? new ChangeSet(), copies: [], warnings: [] }
      })

      // Act
      const result = await sut.process(lines, revisions)

      // Assert
      expect(result.changes.toElements()).toEqual([manifest])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given single line with result', () => {
    it('When processed, Then returns merged result (not empty)', async () => {
      // Arrange
      const lines = ['test']
      mockCollect.mockImplementation(async sink => {
        sink?.addElement({
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: 'Test',
          changeKind: ChangeKind.Add,
        })
        return { changes: sink ?? new ChangeSet(), copies: [], warnings: [] }
      })

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(result.changes.toElements()).toHaveLength(1)
      expect(result.changes.toElements()[0].type).toBe('ApexClass')
    })
  })

  describe('Given revisions override, effectiveConfig construction', () => {
    const MockedTypeHandlerFactory = vi.mocked(TypeHandlerFactory)

    it('When revisions provided, Then TypeHandlerFactory receives config merged with revision from', async () => {
      // Arrange — L25:33 mutant replaces `{ ...this.config, ...revisions }` with `{}`
      // so effectiveConfig would be missing the revision values
      mockCollect.mockResolvedValue(emptyResult())
      const revisions = { from: 'rev-from', to: 'rev-to' }

      // Act
      await sut.process(['line'], revisions)

      // Assert — TypeHandlerFactory constructor first arg is effectiveConfig
      const effectiveConfig = MockedTypeHandlerFactory.mock.calls.at(
        -1
      )![0] as Config
      expect(effectiveConfig.from).toBe('rev-from')
      expect(effectiveConfig.to).toBe('rev-to')
    })

    it('When revisions provided, Then TypeHandlerFactory receives config with all original config fields preserved', async () => {
      // Arrange — L25:9 mutant replaces `{ ...this.config, ...revisions }` with `{}`
      // so effectiveConfig would be empty, losing all original config fields
      mockCollect.mockResolvedValue(emptyResult())
      config.generateDelta = true
      config.output = 'custom-output'
      const revisions = { from: 'sha-a', to: 'sha-b' }

      // Act
      await sut.process(['line'], revisions)

      // Assert — effectiveConfig must retain all original config properties
      const effectiveConfig = MockedTypeHandlerFactory.mock.calls.at(
        -1
      )![0] as Config
      expect(effectiveConfig.generateDelta).toBe(true)
      expect(effectiveConfig.output).toBe('custom-output')
      expect(effectiveConfig.source).toBe(config.source)
    })

    it('When no revisions provided, Then TypeHandlerFactory receives the original config reference', async () => {
      // Arrange — when revisions is undefined, effectiveConfig should equal config (same reference)
      mockCollect.mockResolvedValue(emptyResult())

      // Act
      await sut.process(['line'])

      // Assert
      const effectiveConfig = MockedTypeHandlerFactory.mock.calls.at(
        -1
      )![0] as Config
      expect(effectiveConfig).toBe(config)
    })
  })
})
