'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomLabelHandler from '../../../../src/service/customLabelHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig } from '../../../__utils__/testWork'

const { mockRun, mockWriter } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockWriter: vi.fn(),
}))

vi.mock('../../../../src/utils/metadataDiff', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { run: mockRun }
    }),
  }
})
vi.mock('../../../../src/utils/fsHelper')

const labelType = {
  directoryName: 'labels',
  inFolder: false,
  metaFile: false,
  parentXmlName: 'CustomLabels',
  xmlName: 'CustomLabel',
  childXmlNames: ['CustomLabel'],
  suffix: 'labels',
  xmlTag: 'labels',
  key: 'fullName',
}

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})
let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
})

describe('Decomposed CustomLabel spec', () => {
  const line = 'force-app/main/default/labels/Test.label-meta.xml'

  describe('collect', () => {
    it('Given decomposed label addition, When collectAddition, Then returns Package manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `A       ${line}`,
        labelType,
        globalMetadata
      )
      const sut = new CustomLabelHandler(changeType, element, config)

      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomLabel',
            member: 'Test',
          }),
        ])
      )
    })

    it('Given decomposed label modification, When collectModification, Then returns Package manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `M       ${line}`,
        labelType,
        globalMetadata
      )
      const sut = new CustomLabelHandler(changeType, element, config)

      // Act
      const result = await sut.collectModification()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomLabel',
            member: 'Test',
          }),
        ])
      )
    })

    it('Given decomposed label deletion, When collectDeletion, Then returns DestructiveChanges manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `D       ${line}`,
        labelType,
        globalMetadata
      )
      const sut = new CustomLabelHandler(changeType, element, config)

      // Act
      const result = await sut.collectDeletion()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'CustomLabel',
            member: 'Test',
          }),
        ])
      )
      expect(result.copies).toHaveLength(0)
    })

    it('Given decomposed label addition, When collect, Then returns Package manifest with GitCopy', async () => {
      // Arrange
      const decomposedLine =
        'A       force-app/main/default/labels/Test.label-meta.xml'
      const { changeType, element } = createElement(
        decomposedLine,
        labelType,
        globalMetadata
      )
      const sut = new CustomLabelHandler(changeType, element, config)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomLabel',
            member: 'Test',
          }),
        ])
      )
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given inFile labels addition, When collect, Then delegates to inFile collect logic', async () => {
      // Arrange
      const inFileLine =
        'A       force-app/main/default/labels/CustomLabels.labels-meta.xml'
      const { changeType, element } = createElement(
        inFileLine,
        labelType,
        globalMetadata
      )
      const sut = new CustomLabelHandler(changeType, element, config)
      mockRun.mockImplementation(() =>
        Promise.resolve({
          manifests: {
            added: [{ type: 'CustomLabel', member: 'MyLabel' }],
            modified: [],
            deleted: [],
          },
          hasPackageContent: true,
          writer: mockWriter,
        })
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'CustomLabel',
            member: 'MyLabel',
          }),
        ])
      )
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.StreamedContent)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given inFile labels addition with non-empty content, When collect, Then _collectsContainer prevents container manifest', async () => {
      // Arrange
      const inFileLine =
        'A       force-app/main/default/labels/CustomLabels.labels-meta.xml'
      const { changeType, element } = createElement(
        inFileLine,
        labelType,
        globalMetadata
      )
      const sut = new CustomLabelHandler(changeType, element, config)
      mockRun.mockImplementation(() =>
        Promise.resolve({
          manifests: {
            added: [{ type: 'CustomLabel', member: 'MyLabel' }],
            modified: [],
            deleted: [],
          },
          hasPackageContent: true,
          writer: mockWriter,
        })
      )

      // Act
      const result = await sut.collect()

      // Assert
      const containerManifest = elementsOf(result).find(
        m => m.type === 'CustomLabels'
      )
      expect(containerManifest).toBeUndefined()
      expect(elementsOf(result)).toHaveLength(1)
      expect(elementsOf(result)[0].type).toBe('CustomLabel')
    })
  })
})
