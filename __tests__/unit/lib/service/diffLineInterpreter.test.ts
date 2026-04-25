'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import TypeHandlerFactory from '../../../../src/service/typeHandlerFactory'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import {
  ChangeKind,
  emptyResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import ChangeSet from '../../../../src/utils/changeSet'
import { getWork } from '../../../__utils__/testWork'

const { mockCollect } = vi.hoisted(() => ({
  mockCollect: vi.fn<() => Promise<HandlerResult>>(),
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

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  mockCollect.mockResolvedValue(emptyResult())
  work = getWork()
})

describe('DiffLineInterpreter', () => {
  let sut: DiffLineInterpreter
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    sut = new DiffLineInterpreter(work, globalMetadata)
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
      mockCollect.mockResolvedValue({
        changes: ChangeSet.from([manifest]),
        copies: [],
        warnings: [],
      })

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(result.changes.toElements()).toEqual([manifest])
    })

    it('Given slow handlers, When queue workers finish after enqueuing, Then all results are collected', async () => {
      // Arrange
      const lines = ['a', 'b', 'c']
      const expectedResult: HandlerResult = {
        changes: ChangeSet.from([
          {
            target: ManifestTarget.Package,
            type: 'CustomLabel',
            member: 'test',
            changeKind: ChangeKind.Modify,
          },
        ]),
        copies: [],
        warnings: [],
      }
      mockCollect.mockImplementation(
        () =>
          new Promise(resolve => setImmediate(() => resolve(expectedResult)))
      )

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
      mockCollect.mockResolvedValue({
        changes: ChangeSet.from([manifest]),
        copies: [],
        warnings: [],
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
      mockCollect.mockResolvedValue({
        changes: ChangeSet.from([
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'Test',
            changeKind: ChangeKind.Add,
          },
        ]),
        copies: [],
        warnings: [],
      })

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(result.changes.toElements()).toHaveLength(1)
      expect(result.changes.toElements()[0].type).toBe('ApexClass')
    })
  })

  describe('Given revisions override, effectiveWork construction', () => {
    const MockedTypeHandlerFactory = vi.mocked(TypeHandlerFactory)

    it('When revisions provided, Then TypeHandlerFactory receives work with merged config containing revision from', async () => {
      // Arrange — L25:33 mutant replaces `{ ...this.work.config, ...revisions }` with `{}`
      // so effectiveWork.config would be missing the revision values
      mockCollect.mockResolvedValue(emptyResult())
      const revisions = { from: 'rev-from', to: 'rev-to' }

      // Act
      await sut.process(['line'], revisions)

      // Assert — TypeHandlerFactory constructor first arg is effectiveWork
      const effectiveWork = MockedTypeHandlerFactory.mock.calls.at(
        -1
      )![0] as Work
      expect(effectiveWork.config.from).toBe('rev-from')
      expect(effectiveWork.config.to).toBe('rev-to')
    })

    it('When revisions provided, Then TypeHandlerFactory receives work with all original work fields preserved', async () => {
      // Arrange — L25:9 mutant replaces `{ ...this.work, config: ... }` with `{}`
      // so effectiveWork would be empty, losing all work fields (changes, warnings, etc.)
      mockCollect.mockResolvedValue(emptyResult())
      work.config.generateDelta = true
      work.config.output = 'custom-output'
      const revisions = { from: 'sha-a', to: 'sha-b' }

      // Act
      await sut.process(['line'], revisions)

      // Assert — effectiveWork must retain all original work properties
      const effectiveWork = MockedTypeHandlerFactory.mock.calls.at(
        -1
      )![0] as Work
      expect(effectiveWork.config.generateDelta).toBe(true)
      expect(effectiveWork.config.output).toBe('custom-output')
      expect(effectiveWork.warnings).toBe(work.warnings)
    })

    it('When no revisions provided, Then TypeHandlerFactory receives the original work reference', async () => {
      // Arrange — when revisions is undefined, effectiveWork should equal work (same reference)
      mockCollect.mockResolvedValue(emptyResult())

      // Act
      await sut.process(['line'])

      // Assert
      const effectiveWork = MockedTypeHandlerFactory.mock.calls.at(
        -1
      )![0] as Work
      expect(effectiveWork).toBe(work)
    })
  })
})
