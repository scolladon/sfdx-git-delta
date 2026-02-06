'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomFieldHandler from '../../../../src/service/customFieldHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readPathFromGit } from '../../../../src/utils/fsHelper'
import type { MetadataBoundaryResolver } from '../../../../src/utils/metadataBoundaryResolver'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadPathFromGit = jest.mocked(readPathFromGit)
const mockResolver = {
  resolve: async () => null,
} as unknown as MetadataBoundaryResolver

const objectType = {
  directoryName: 'fields',
  inFolder: false,
  metaFile: false,
  suffix: 'field',
  parentXmlName: 'CustomObject',
  xmlName: 'CustomField',
}
const line =
  'A       force-app/main/default/objects/Account/fields/awesome.field-meta.xml'

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('CustomFieldHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new CustomFieldHandler(
        line,
        objectType,
        work,
        globalMetadata,
        mockResolver
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(readPathFromGit).not.toHaveBeenCalled()
    })
  })
  describe('when called with generateDelta true', () => {
    describe(`when field is not master detail`, () => {
      it('should not handle master detail exception', async () => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce('')
        const sut = new CustomFieldHandler(
          line,
          objectType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(1)
      })
    })
    describe(`when field is master detail`, () => {
      it('should copy the parent object', async () => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce(MASTER_DETAIL_TAG)
        const sut = new CustomFieldHandler(
          line,
          objectType,
          work,
          globalMetadata,
          mockResolver
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(2)
      })
    })
  })
})
