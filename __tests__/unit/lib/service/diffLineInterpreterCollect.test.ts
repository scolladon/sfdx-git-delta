'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { HandlerResult } from '../../../../src/types/handlerResult'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

const mockCollect = jest.fn<() => Promise<HandlerResult>>()

jest.mock('../../../../src/service/typeHandlerFactory', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        getTypeHandler: jest.fn().mockImplementation(async () => ({
          collect: mockCollect,
        })),
      }
    }),
  }
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('DiffLineInterpreter.process', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('Given lines with handlers returning results', () => {
    it('When process is called, Then merges all handler results', async () => {
      // Arrange
      mockCollect.mockResolvedValue({
        manifests: [
          {
            target: ManifestTarget.Package,
            type: 'ApexClass',
            member: 'MyClass',
          },
        ],
        copies: [
          {
            kind: CopyOperationKind.GitCopy,
            path: 'classes/MyClass.cls',
            revision: 'sha123',
          },
        ],
        warnings: [],
      })
      const sut = new DiffLineInterpreter(work, globalMetadata)

      // Act
      const result = await sut.process(['line1', 'line2'])

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(2)
      expect(result.manifests).toHaveLength(2)
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
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('Given revision overrides', () => {
    it('When process is called with revisions, Then uses override revisions', async () => {
      // Arrange
      mockCollect.mockResolvedValue({
        manifests: [],
        copies: [],
        warnings: [],
      })
      const sut = new DiffLineInterpreter(work, globalMetadata)

      // Act
      const result = await sut.process(['line1'], {
        from: 'override-from',
        to: 'override-to',
      })

      // Assert
      expect(mockCollect).toHaveBeenCalledTimes(1)
      expect(result.manifests).toEqual([])
    })
  })

  describe('Given handlers that return warnings', () => {
    it('When process is called, Then warnings are collected', async () => {
      // Arrange
      mockCollect.mockResolvedValue({
        manifests: [],
        copies: [],
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
