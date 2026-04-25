'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import {
  ChangeKind,
  CopyOperationKind,
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
        getTypeHandler: vi.fn().mockImplementation(async () => ({
          collect: mockCollect,
        })),
      }
    }),
  }
})

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  work = getWork()
})

describe('DiffLineInterpreter.process', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('Given lines with handlers returning results', () => {
    it('When process is called, Then merges all handler results', async () => {
      // Arrange — distinct member per handler so the union ChangeSet keeps
      // both, not deduplicated.
      let seq = 0
      mockCollect.mockImplementation((sink?: ChangeSet) => {
        const i = seq++
        sink?.addElement({
          target: ManifestTarget.Package,
          type: 'ApexClass',
          member: `MyClass${i}`,
          changeKind: ChangeKind.Add,
        })
        return Promise.resolve({
          changes: sink ?? new ChangeSet(),
          copies: [
            {
              kind: CopyOperationKind.GitCopy,
              path: `classes/MyClass${i}.cls`,
              revision: 'sha123',
            },
          ],
          warnings: [],
        })
      })
      const sut = new DiffLineInterpreter(work, globalMetadata)

      // Act
      const result = await sut.process(['line1', 'line2'])

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(2)
      expect(result.changes.toElements()).toHaveLength(2)
      expect(result.copies).toHaveLength(2)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Given empty lines', () => {
    it('When process is called, Then returns empty result', async () => {
      // Arrange
      const sut = new DiffLineInterpreter(work, globalMetadata)

      // Act
      const result = await sut.process([])

      // Assert
      expect(mockCollect).not.toHaveBeenCalled()
      expect(result.changes.toElements()).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given revision overrides', () => {
    it('When process is called with revisions, Then uses override revisions', async () => {
      // Arrange
      mockCollect.mockResolvedValue(emptyResult())
      const sut = new DiffLineInterpreter(work, globalMetadata)

      // Act
      const result = await sut.process(['line1'], {
        from: 'override-from',
        to: 'override-to',
      })

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(1)
      expect(result.changes.toElements()).toEqual([])
    })
  })

  describe('Given handlers that return warnings', () => {
    it('When process is called, Then warnings are collected', async () => {
      // Arrange
      mockCollect.mockResolvedValue({
        ...emptyResult(),
        warnings: [new Error('test warning')],
      })
      const sut = new DiffLineInterpreter(work, globalMetadata)

      // Act
      const result = await sut.process(['line1'])

      // Assert
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toBe('test warning')
    })
  })
})
