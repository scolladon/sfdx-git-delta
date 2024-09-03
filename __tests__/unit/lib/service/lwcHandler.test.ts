'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import LwcHandler from '../../../../src/service/lwcHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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
    globalMetadata = await getGlobalMetadata()
  })
  describe('when the line should not be processed', () => {
    it.each([`${basePath}/.eslintrc.json`, `${basePath}/jsconfig.json`])(
      'does not handle the line',
      async entityPath => {
        // Arrange
        const sut = new LwcHandler(
          `${ADDITION}       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.size).toBe(0)
        expect(copyFiles).not.toHaveBeenCalled()
      }
    )
  })

  describe('when the line should be processed', () => {
    it.each([ADDITION, MODIFICATION])(
      'handles the line for "%s" type change',
      async changeType => {
        // Arrange
        const sut = new LwcHandler(
          `${changeType}       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.get(xmlName)).toEqual(new Set([element]))
        expect(copyFiles).toHaveBeenCalled()
      }
    )

    it('handles the line for "D" type change', async () => {
      // Arrange
      const sut = new LwcHandler(
        `${DELETION}       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

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
