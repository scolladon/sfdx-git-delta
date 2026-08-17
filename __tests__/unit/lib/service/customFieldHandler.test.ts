'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MASTER_DETAIL_TAG } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomFieldHandler from '../../../../src/service/customFieldHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { contentIncludes } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const mockedContentIncludes = vi.mocked(contentIncludes)

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

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
})

describe('CustomFieldHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('collect', () => {
    it('Given non-master-detail field addition, When collect, Then returns manifest and file copy without parent', async () => {
      // Arrange
      mockedContentIncludes.mockResolvedValueOnce(false)
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given addition with generateDelta false, When collect, Then returns manifest without copies', async () => {
      // Arrange
      config.generateDelta = false
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toHaveLength(1)
      expect(elementsOf(result)[0].target).toBe(ManifestTarget.Package)
      expect(result.copies).toHaveLength(0)
      expect(mockedContentIncludes).not.toHaveBeenCalled()
    })

    it('Given master-detail field addition, When collect, Then includes parent object copies', async () => {
      // Arrange
      mockedContentIncludes.mockResolvedValueOnce(true)
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given field addition under an object folder literally named "Custom[1]__c", When collect, Then contentIncludes is called with the bracketed basePath', async () => {
      // Arrange
      mockedContentIncludes.mockResolvedValueOnce(true)
      const bracketedLine =
        'A       force-app/main/default/objects/Custom[1]__c/fields/awesome.field-meta.xml'
      const { changeType, element } = createElement(
        bracketedLine,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      await sut.collect()

      // Assert
      expect(mockedContentIncludes).toHaveBeenCalledWith(
        MASTER_DETAIL_TAG,
        'force-app/main/default/objects/Custom[1]__c/fields/awesome.field-meta.xml',
        expect.anything()
      )
    })
  })
})
