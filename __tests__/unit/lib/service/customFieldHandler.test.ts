'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomFieldHandler from '../../../../src/service/customFieldHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readPathFromGit } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadPathFromGit = jest.mocked(readPathFromGit)

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
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(changeType, element, work)

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
        const { changeType, element } = createElement(
          line,
          objectType,
          globalMetadata
        )
        const sut = new CustomFieldHandler(changeType, element, work)

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
        const { changeType, element } = createElement(
          line,
          objectType,
          globalMetadata
        )
        const sut = new CustomFieldHandler(changeType, element, work)

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('collect', () => {
    it('Given non-master-detail field addition, When collect, Then returns manifest and file copy without parent', async () => {
      // Arrange
      mockedReadPathFromGit.mockResolvedValueOnce('')
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomField',
            member: 'Account.awesome',
          }),
        ])
      )
      expect(result.copies).toHaveLength(1)
      expect(result.copies[0].kind).toBe(CopyOperationKind.GitCopy)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given master-detail field addition, When collect, Then includes parent object copies', async () => {
      // Arrange
      mockedReadPathFromGit.mockResolvedValueOnce(MASTER_DETAIL_TAG)
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomField',
            member: 'Account.awesome',
          }),
        ])
      )
      expect(result.copies.length).toBeGreaterThan(1)
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('Account.object-meta.xml')
        )
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
