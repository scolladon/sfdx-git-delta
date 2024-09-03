'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import CustomLabelHandler from '../../../../src/service/customLabelHandler'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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
  globalMetadata = await getGlobalMetadata()
})
let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('Decomposed CustomLabel spec', () => {
  const line = 'force-app/main/default/labels/Test.label-meta.xml'
  describe('when file is added', () => {
    let sut: CustomLabelHandler
    beforeEach(() => {
      // Arrange
      sut = new CustomLabelHandler(line, labelType, work, globalMetadata)
    })
    it('should add the element in the package', async () => {
      // Arrange

      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(work.diffs.package.get('CustomLabel')).toEqual(new Set(['Test']))
    })
  })

  describe('when file is modified', () => {
    let sut: CustomLabelHandler
    beforeEach(() => {
      // Arrange
      sut = new CustomLabelHandler(line, labelType, work, globalMetadata)
    })
    it('should add the element in the package', async () => {
      // Arrange

      // Act
      await sut.handleModification()

      // Assert
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(work.diffs.package.get('CustomLabel')).toEqual(new Set(['Test']))
    })
  })

  describe('when file is deleted', () => {
    let sut: CustomLabelHandler
    beforeEach(() => {
      // Arrange
      sut = new CustomLabelHandler(line, labelType, work, globalMetadata)
    })
    it('should add the element in the destructiveChanges', async () => {
      // Arrange

      // Act
      await sut.handleDeletion()

      // Assert
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.get('CustomLabel')).toEqual(
        new Set(['Test'])
      )
    })
  })
})
