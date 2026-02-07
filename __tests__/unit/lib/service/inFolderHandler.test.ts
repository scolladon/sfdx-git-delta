'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InFolder from '../../../../src/service/inFolderHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
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

  describe('collect', () => {
    it('Given unprocessable line, When collect, Then returns empty result', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `A       force-app/main/default/${objectType.directoryName}/test.otherExtension`,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(0)
      expect(result.copies).toHaveLength(0)
    })

    it('Given document addition, When collect, Then returns manifest and folder meta copies', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Document',
            member: entity,
          }),
        ])
      )
      expect(
        result.copies.some(
          c =>
            c.kind === CopyOperationKind.GitCopy &&
            c.path.includes(METAFILE_SUFFIX)
        )
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given document addition with matching special extension files, When collect, Then includes special extension copies', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([entity, 'not/matching'])
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Document',
            member: entity,
          }),
        ])
      )
      expect(result.copies.length).toBeGreaterThan(1)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given folder name ending with INFOLDER_SUFFIX, When collect, Then folder meta copy uses empty suffix', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const folderSuffixLine = `A       force-app/main/default/${objectType.directoryName}/testFolder/test.${extension}${METAFILE_SUFFIX}`
      const { changeType, element } = createElement(
        folderSuffixLine,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Document',
          }),
        ])
      )
      const folderMetaCopy = result.copies.find(c =>
        c.path.includes('testFolder' + METAFILE_SUFFIX)
      )
      expect(folderMetaCopy).toBeDefined()
    })
  })
})
