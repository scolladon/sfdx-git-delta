'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DecomposedHandler from '../../../../src/service/decomposedHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const line =
  'A       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml'

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  work.config.generateDelta = false
})

describe('DecomposedHandler', () => {
  describe('collect', () => {
    const recordTypeWithParent = {
      directoryName: 'recordTypes',
      inFolder: false,
      metaFile: false,
      suffix: 'recordType',
      xmlName: 'RecordType',
      parentXmlName: 'CustomObject',
    }

    it.each([
      'collectAddition',
      'collectModification',
    ])('Given %s, When called, Then element name has the parent metadata', async method => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(changeType, element, work)

      // Act
      const result =
        await sut[method as 'collectAddition' | 'collectModification']()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'RecordType',
            member: 'Account.Test',
          }),
        ])
      )
    })

    it('Given collectDeletion, When called, Then element name has the parent metadata in destructiveChanges', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'D       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml',
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collectDeletion()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'RecordType',
            member: 'Account.Test',
          }),
        ])
      )
    })

    it('Given addition, When collectAddition, Then returns manifest and parent meta copies', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'RecordType',
            member: 'Account.Test',
          }),
        ])
      )
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('Account.object-meta.xml')
        )
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given deletion, When collect, Then returns destructiveChanges manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'D       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml',
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'RecordType',
            member: 'Account.Test',
          }),
        ])
      )
      expect(result.copies).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
