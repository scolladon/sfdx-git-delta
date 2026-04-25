'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../../../../src/utils/fsHelper')

const line =
  'A       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml'

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
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
      expect(result.changes.toElements()).toEqual(
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
      expect(result.changes.toElements()).toEqual(
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
      work.config.generateDelta = true
      const { changeType, element } = createElement(
        line,
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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
      expect(result.changes.toElements()).toEqual(
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

    it('Given a recordType whose parentType has no suffix, When collectAddition runs, Then _collectParentCopies returns early without pushing a parent copy (decomposedHandler L21)', async () => {
      // Arrange — recordType without parentXmlName means getParentType()
      // resolves to undefined / no-suffix; the early-return arm fires.
      // Without this guard, _collectParentCopies would join a path with
      // an undefined suffix and emit a junk copy.
      work.config.generateDelta = true
      const recordTypeWithoutParent = {
        directoryName: 'recordTypes',
        inFolder: false,
        metaFile: false,
        suffix: 'recordType',
        xmlName: 'RecordType',
        // parentXmlName intentionally omitted
      }
      const { changeType, element } = createElement(
        line,
        recordTypeWithoutParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(changeType, element, work)

      // Act
      const result = await sut.collectAddition()

      // Assert — only the recordType file itself is in copies; no parent
      // (object) meta file is appended via _collectParentCopies because
      // parentType.suffix is undefined.
      const parentCopies = result.copies.filter(
        c =>
          c.kind === CopyOperationKind.GitCopy &&
          'path' in c &&
          c.path.includes('/Account/Account.')
      )
      expect(parentCopies).toHaveLength(0)
    })
  })
})
