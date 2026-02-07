'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomObjectHandler from '../../../../src/service/customObjectHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import {
  copyFiles,
  pathExists,
  readDirs,
  readPathFromGit,
} from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedPathExist = jest.mocked(pathExists)
const mockedReadDirs = jest.mocked(readDirs)
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
    globalMetadata = await getDefinition({})
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectHandler(changeType, element, work)

      // Act
      await sut.handleAddition()

      // Assert
      expect(pathExists).not.toHaveBeenCalled()
    })
  })

  describe('when called with generateDelta true', () => {
    describe(`when called with not 'objects' type`, () => {
      it('should not handle try to find master details fields', async () => {
        // Arrange
        const { changeType, element } = createElement(
          'A       force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
          territoryModelType,
          globalMetadata
        )
        const sut = new CustomObjectHandler(changeType, element, work)

        // Act
        await sut.handleAddition()

        // Assert
        expect(pathExists).not.toHaveBeenCalled()
      })
    })

    describe('when field folder exist', () => {
      describe('when field folder contains master details', () => {
        it('should copy master detail fields', async () => {
          // Arrange
          mockedReadDirs.mockResolvedValueOnce(['Name.field-meta.xml'])
          mockedReadPathFromGit.mockResolvedValueOnce(MASTER_DETAIL_TAG)
          const { changeType, element } = createElement(
            line,
            objectType,
            globalMetadata
          )
          const sut = new CustomObjectHandler(changeType, element, work)

          // Act
          await sut.handleAddition()

          // Assert
          expect(copyFiles).toHaveBeenCalledTimes(2)
        })
      })

      describe('when field folder does not contain master details', () => {
        it('should not copy master detail fields', async () => {
          // Arrange
          mockedReadDirs.mockResolvedValue([])
          mockedReadPathFromGit.mockResolvedValueOnce('')
          const { changeType, element } = createElement(
            line,
            objectType,
            globalMetadata
          )
          const sut = new CustomObjectHandler(changeType, element, work)

          // Act
          await sut.handleAddition()

          // Assert
          expect(copyFiles).toHaveBeenCalledTimes(1)
        })
      })
    })

    describe('when field folder does not exist', () => {
      it('should not look into the field folder', async () => {
        // Arrange
        mockedPathExist.mockResolvedValueOnce(false)
        const { changeType, element } = createElement(
          line,
          objectType,
          globalMetadata
        )
        const sut = new CustomObjectHandler(changeType, element, work)

        // Act
        await sut.handleAddition()

        // Assert
        expect(readDirs).not.toHaveBeenCalled()
      })
    })
  })

  describe('collect', () => {
    it('Given object addition with no master detail, When collect, Then returns manifest and file copy', async () => {
      // Arrange
      mockedPathExist.mockResolvedValueOnce(false)
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomObject',
            member: 'Account',
          }),
        ])
      )
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given territory2Model addition, When collect, Then returns manifest without master detail check', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'A       force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
        territoryModelType,
        globalMetadata
      )
      const sut = new CustomObjectHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Territory2Model',
            member: 'EU',
          }),
        ])
      )
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(pathExists).not.toHaveBeenCalled()
      expect(result.warnings).toHaveLength(0)
    })
  })
})
