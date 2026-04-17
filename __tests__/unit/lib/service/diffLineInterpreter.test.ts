'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import {
  emptyResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
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

      // Act
      await sut.process(lines)

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(lines.length)
    })

    it('Given slow handlers, When queue workers finish after enqueuing, Then all results are collected', async () => {
      // Arrange
      const lines = ['a', 'b', 'c']
      const expectedResult: HandlerResult = {
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'CustomLabel',
            member: 'test',
          },
        ],
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
      expect(result.manifests).toHaveLength(3)
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
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given revisions parameter', () => {
    it('When revisions are provided, Then uses them in effectiveWork', async () => {
      // Arrange
      const lines = ['test']
      const revisions = { from: 'sha1', to: 'sha2' }

      // Act
      const result = await sut.process(lines, revisions)

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(1)
      expect(result).toBeDefined()
    })
  })

  describe('Given single line with result', () => {
    it('When processed, Then returns merged result (not empty)', async () => {
      // Arrange
      const lines = ['test']
      mockCollect.mockResolvedValue({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'Test',
          },
        ],
        copies: [],
        warnings: [],
      })

      // Act
      const result = await sut.process(lines)

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0].type).toBe('ApexClass')
    })
  })
})
