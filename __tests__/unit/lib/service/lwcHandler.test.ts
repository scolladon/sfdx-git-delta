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
import type { Work } from '../../../../src/types/work'
import { copyFiles } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

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
      await sut.handle()

      // Assert
      expect(work.diffs.package.size).toBe(0)
      expect(copyFiles).not.toHaveBeenCalled()
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
      await sut.handle()

      // Assert
      expect(work.diffs.package.get(xmlName)).toEqual(new Set([element]))
      expect(copyFiles).toHaveBeenCalled()
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
      await sut.handle()

      // Assert
      expect(work.diffs.destructiveChanges.get(xmlName)).toEqual(
        new Set([element])
      )
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
})
