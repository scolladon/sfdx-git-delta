'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomFieldHandler from '../../../../src/service/customFieldHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { contentIncludes } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

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

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  work = getWork()
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
      const sut = new CustomFieldHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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
      work.config.generateDelta = false
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomFieldHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toHaveLength(1)
      expect(result.changes.toElements()[0].target).toBe(ManifestTarget.Package)
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
      const sut = new CustomFieldHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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
