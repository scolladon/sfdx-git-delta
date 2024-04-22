'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import CustomObjectHandler from '../../../../src/service/customObjectHandler'
import type { Work } from '../../../../src/types/work'
import {
  copyFiles,
  pathExists,
  readDir,
  readPathFromGit,
} from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const mockedPathExist = jest.mocked(pathExists)
const mockedReadDir = jest.mocked(readDir)
const mockedReadPathFromGit = jest.mocked(readPathFromGit)

mockedPathExist.mockResolvedValue(true)

const territoryModelType = {
  childXmlNames: ['Territory2Rule', 'Territory2'],
  directoryName: 'territory2Models',
  inFolder: false,
  metaFile: false,
  suffix: 'territory2Model',
  xmlName: 'Territory2Model',
}
const objectType = {
  childXmlNames: [
    'CustomField',
    'Index',
    'BusinessProcess',
    'RecordType',
    'CompactLayout',
    'WebLink',
    'ValidationRule',
    'SharingReason',
    'ListView',
    'FieldSet',
  ],
  directoryName: 'objects',
  inFolder: false,
  metaFile: false,
  suffix: 'object',
  xmlName: 'CustomObject',
}

const line =
  'A       force-app/main/default/objects/Account/Account.object-meta.xml'

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('CustomObjectHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new CustomObjectHandler(
        line,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(pathExists).not.toBeCalled()
    })
  })

  describe('when called with generateDelta true', () => {
    describe(`when called with not 'objects' type`, () => {
      it('should not handle try to find master details fields', async () => {
        // Arrange
        const sut = new CustomObjectHandler(
          'A       force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
          territoryModelType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(pathExists).not.toBeCalled()
      })
    })

    describe('when field folder exist', () => {
      describe('when field folder contains master details', () => {
        it('should copy master detail fields', async () => {
          // Arrange
          mockedReadDir.mockResolvedValueOnce(['Name.field-meta.xml'])
          mockedReadPathFromGit.mockResolvedValueOnce(MASTER_DETAIL_TAG)
          const sut = new CustomObjectHandler(
            line,
            objectType,
            work,
            globalMetadata
          )

          // Act
          await sut.handleAddition()

          // Assert
          expect(copyFiles).toBeCalledTimes(2)
        })
      })

      describe('when field folder does not contain master details', () => {
        it('should not copy master detail fields', async () => {
          // Arrange
          mockedReadDir.mockResolvedValue([])
          mockedReadPathFromGit.mockResolvedValueOnce('')
          const sut = new CustomObjectHandler(
            line,
            objectType,
            work,
            globalMetadata
          )

          // Act
          await sut.handleAddition()

          // Assert
          expect(copyFiles).toBeCalledTimes(1)
        })
      })
    })

    describe('when field folder does not exist', () => {
      it('should not look into the field folder', async () => {
        // Arrange
        mockedPathExist.mockResolvedValueOnce(false)
        const sut = new CustomObjectHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readDir).not.toBeCalled()
      })
    })
  })
})
