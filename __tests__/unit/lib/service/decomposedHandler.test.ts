'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_TREE_INDEXES } from '../../../../src/adapter/gitTreeLister'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DecomposedHandler from '../../../../src/service/decomposedHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const line =
  'A       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml'

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
  config.generateDelta = false
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

    it.each(['collectAddition', 'collectModification'])(
      'Given %s, When called, Then element name has the parent metadata',
      async method => {
        // Arrange
        const { changeType, element } = createElement(
          line,
          recordTypeWithParent,
          globalMetadata
        )
        const sut = new DecomposedHandler(
          changeType,
          element,
          config,
          EMPTY_TREE_INDEXES
        )

        // Act
        const result =
          await sut[method as 'collectAddition' | 'collectModification']()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'RecordType',
              member: 'Account.Test',
            }),
          ])
        )
      }
    )

    it('Given collectDeletion, When called, Then element name has the parent metadata in destructiveChanges', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'D       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml',
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(
        changeType,
        element,
        config,
        EMPTY_TREE_INDEXES
      )

      // Act
      const result = await sut.collectDeletion()

      // Assert
      expect(elementsOf(result)).toEqual(
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
      config.generateDelta = true
      const { changeType, element } = createElement(
        line,
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(
        changeType,
        element,
        config,
        EMPTY_TREE_INDEXES
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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
      const sut = new DecomposedHandler(
        changeType,
        element,
        config,
        EMPTY_TREE_INDEXES
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given addition, When collectAddition, Then the element own copy from the parent call survives alongside the parent meta copy (decomposedHandler L10)', async () => {
      // Arrange
      config.generateDelta = true
      const { changeType, element } = createElement(
        line,
        recordTypeWithParent,
        globalMetadata
      )
      const sut = new DecomposedHandler(
        changeType,
        element,
        config,
        EMPTY_TREE_INDEXES
      )

      // Act
      const result = await sut.collectAddition()

      // Assert — a `copies = []` regression would discard the copy
      // super.collectAddition() already produced for the element itself,
      // leaving only the copy _collectParentCopies appends.
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('recordTypes/Test.recordType-meta.xml')
        )
      ).toBe(true)
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes('Account.object-meta.xml')
        )
      ).toBe(true)
    })

    it('Given a recordType whose parentType has no suffix, When collectAddition runs, Then _collectParentCopies returns early without pushing a parent copy (decomposedHandler L21)', async () => {
      // Arrange — recordType without parentXmlName means getParentType()
      // resolves to undefined / no-suffix; the early-return arm fires.
      // Without this guard, _collectParentCopies would join a path with
      // an undefined suffix and emit a junk copy.
      config.generateDelta = true
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
      const sut = new DecomposedHandler(
        changeType,
        element,
        config,
        EMPTY_TREE_INDEXES
      )

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
