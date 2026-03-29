'use strict'

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

vi.mock('node:os', async () => ({
  ...((await vi.importActual('node:os')) as object),
  availableParallelism: null,
}))

import type { HandlerResult } from '../../../../src/types/handlerResult'
import { emptyResult } from '../../../../src/types/handlerResult'

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

  describe('compatibility test', () => {
    beforeEach(() => {
      sut = new DiffLineInterpreter(work, globalMetadata)
    })
    describe('when `availableParallelism` is not defined', () => {
      it('fallback gracefully', async () => {
        // Arrange
        const lines = ['test']

        // Act
        await sut.process(lines)

        // Assert
        expect(mockCollect).toHaveBeenCalledTimes(lines.length)
      })
    })
  })
})
