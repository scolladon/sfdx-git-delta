'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomObjectHandler from '../../../../src/service/customObjectHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { grepContentUnder, pathExists } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const mockedPathExist = vi.mocked(pathExists)
const mockedGrepContent = vi.mocked(grepContentUnder)

mockedPathExist.mockResolvedValue(true)
mockedGrepContent.mockResolvedValue([])

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

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
})

describe('CustomObjectHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
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
      const sut = new CustomObjectHandler(changeType, element, config)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given object addition with generateDelta false, When collect, Then returns manifest without master detail copies', async () => {
      // Arrange
      config.generateDelta = false
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectHandler(changeType, element, config)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toHaveLength(1)
      expect(elementsOf(result)[0].target).toBe(ManifestTarget.Package)
      expect(result.copies).toHaveLength(0)
      expect(mockedPathExist).not.toHaveBeenCalled()
      expect(mockedGrepContent).not.toHaveBeenCalled()
    })

    it('Given territory2Model addition, When collect, Then returns manifest without master detail check', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'A       force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
        territoryModelType,
        globalMetadata
      )
      const sut = new CustomObjectHandler(changeType, element, config)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given object addition with master detail fields, When collect, Then returns copies for master detail fields', async () => {
      // Arrange
      const masterDetailFieldPath =
        'force-app/main/default/objects/Account/fields/ParentId__c.field-meta.xml'
      mockedGrepContent.mockResolvedValueOnce([masterDetailFieldPath])
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectHandler(changeType, element, config)

      // Act
      const result = await sut.collect()

      // Assert
      expect(mockedGrepContent).toHaveBeenCalledWith(
        MASTER_DETAIL_TAG,
        'force-app/main/default/objects/Account/fields',
        expect.anything()
      )
      const gitCopies = result.copies.filter(
        c => c.kind === CopyOperationKind.GitCopy
      )
      expect(gitCopies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: masterDetailFieldPath }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })
  })
})
