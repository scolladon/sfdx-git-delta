'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import DecomposedHandler from '../../../../src/service/decomposedHandler'
import type { Work } from '../../../../src/types/work'
import { readPathFromGit, copyFiles } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadPathFromGit = jest.mocked(readPathFromGit)

const objectType = {
  directoryName: 'fields',
  inFolder: false,
  metaFile: false,
  suffix: 'field',
  xmlName: 'CustomField',
}
const line =
  'A       force-app/main/default/objects/Account/fields/awesome.field-meta.xml'

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('DecomposedHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new DecomposedHandler(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert
      expect(readPathFromGit).not.toBeCalled()
    })
  })
  describe('when called with generateDelta true', () => {
    describe(`when field is not master detail`, () => {
      it('should not handle master detail exception', async () => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce('')
        const sut = new DecomposedHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toBeCalledTimes(1)
        expect(copyFiles).toBeCalledTimes(1)
      })
    })
    describe(`when field is master detail`, () => {
      it('should copy the parent object', async () => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce(MASTER_DETAIL_TAG)
        const sut = new DecomposedHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toBeCalledTimes(1)
        expect(copyFiles).toBeCalledTimes(2)
      })
    })
  })
})
