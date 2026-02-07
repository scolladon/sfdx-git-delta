'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomObjectHandler from '../../../../src/service/customObjectHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { pathExists } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedPathExist = jest.mocked(pathExists)

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
