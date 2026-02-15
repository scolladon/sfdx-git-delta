'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InFolder from '../../../../src/service/inFolderHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readDirs } from '../../../../src/utils/fsHelper'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = jest.mocked(readDirs)

const entity = 'folder/test'
const extension = 'document'
const objectType = {
  directoryName: 'documents',
  inFolder: true,
  metaFile: true,
  suffix: 'document',
  xmlName: 'Document',
}
const xmlName = 'Document'
const line = `A       force-app/main/default/${objectType.directoryName}/${entity}.${extension}-meta.xml`

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('InFolderHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('when called with generateDelta false', () => {
    beforeEach(() => {
      work.config.generateDelta = false
    })
    it('should not copy meta files nor copy special extension', async () => {
      // Arrange
      const sut = new InFolder(line, objectType, work, globalMetadata)

      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.package.get(xmlName)).toEqual(new Set([entity]))
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
  describe('when called with generateDelta true', () => {
    beforeEach(() => {
      work.config.generateDelta = true
    })

    describe('when readDirs does not return files', () => {
      it('should not copy special extension and copy meta files', async () => {
        // Arrange
        const sut = new InFolder(line, objectType, work, globalMetadata)
        mockedReadDirs.mockImplementation(() => Promise.resolve([]))

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(xmlName)).toEqual(new Set([entity]))
        expect(readDirs).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(3)
        expect(copyFiles).toHaveBeenCalledWith(
          work.config,
          expect.stringContaining(METAFILE_SUFFIX)
        )
      })
    })

    describe('when readDirs returns files', () => {
      it('should copy special extension', async () => {
        // Arrange
        const sut = new InFolder(line, objectType, work, globalMetadata)
        mockedReadDirs.mockImplementationOnce(() =>
          Promise.resolve([entity, 'not/matching'])
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.package.get(xmlName)).toEqual(new Set([entity]))
        expect(readDirs).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(5)
      })
    })
  })
  describe('when the line should not be processed', () => {
    it.each([
      `force-app/main/default/${objectType.directoryName}/test.otherExtension`,
    ])('does not handle the line', async entityPath => {
      // Arrange
      const sut = new InFolder(
        `A       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.package.size).toBe(0)
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
})
