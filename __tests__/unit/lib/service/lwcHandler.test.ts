'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import LwcHandler from '../../../../src/service/lwcHandler'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadDirs = jest.mocked(readDirs)

const objectType = {
  directoryName: 'lwc',
  inFolder: false,
  metaFile: false,
  xmlName: 'LightningComponentBundle',
}
const element = 'component'
const basePath = `force-app/main/default/${objectType.directoryName}`
const entityPath = `${basePath}/${element}/${element}.js`
const xmlName = 'LightningComponentBundle'
let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  mockedReadDirs.mockResolvedValue([])
})

describe('lwcHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })
  describe('when the line should not be processed', () => {
    it.each([
      `${basePath}/.eslintrc.json`,
      `${basePath}/jsconfig.json`,
    ])('does not handle the line', async entityPath => {
      // Arrange
      const { changeType, element: el } = createElement(
        `${ADDITION}       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new LwcHandler(changeType, el, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
    })
  })

  describe('when the line should be processed', () => {
    it.each([
      ADDITION,
      MODIFICATION,
    ])('handles the line for "%s" type change', async changeType => {
      // Arrange
      const { changeType: ct, element: el } = createElement(
        `${changeType}       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new LwcHandler(ct, el, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: xmlName,
            member: element,
          }),
        ])
      )
    })

    it('handles the line for "D" type change', async () => {
      // Arrange
      const { changeType, element: el } = createElement(
        `${DELETION}       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new LwcHandler(changeType, el, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: xmlName,
            member: element,
          }),
        ])
      )
      expect(result.copies).toEqual([])
    })
  })
})
