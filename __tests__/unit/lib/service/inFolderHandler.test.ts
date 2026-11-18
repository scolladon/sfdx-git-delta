'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InFolder from '../../../../src/service/inFolderHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { pathExists, readDirs } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = vi.mocked(readDirs)
const mockedPathExists = vi.mocked(pathExists)

const entity = 'folder/test'
const extension = 'document'
const objectType = {
  directoryName: 'documents',
  inFolder: true,
  metaFile: true,
  suffix: 'document',
  xmlName: 'Document',
}
const DOCUMENT_DIR = `force-app/main/default/${objectType.directoryName}/folder`
const COMPONENT_PATH = `${DOCUMENT_DIR}/test`
const line = `A       force-app/main/default/${objectType.directoryName}/${entity}.${extension}-meta.xml`

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
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
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toHaveLength(0)
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
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given a folder holding the component and look-alike files, When collect, Then copies only the component files', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValueOnce([
        `${DOCUMENT_DIR}/test.png`,
        `${DOCUMENT_DIR}/test10.png`,
        `${DOCUMENT_DIR}/my_test.png`,
        `${DOCUMENT_DIR}/test/inner.png`,
        `${DOCUMENT_DIR}/test.document-meta.xml`,
      ])
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Document',
            member: entity,
          }),
        ])
      )
      const paths = result.copies.map(c => c.path)
      expect(paths).toEqual(
        expect.arrayContaining([
          `${DOCUMENT_DIR}/test.png`,
          `${DOCUMENT_DIR}/test.document-meta.xml`,
          `${DOCUMENT_DIR}/test/inner.png`,
          `${DOCUMENT_DIR}/test/inner.document-meta.xml`,
        ])
      )
      for (const excluded of [
        `${DOCUMENT_DIR}/test10.png`,
        `${DOCUMENT_DIR}/test10.document-meta.xml`,
        `${DOCUMENT_DIR}/my_test.png`,
        `${DOCUMENT_DIR}/my_test.document-meta.xml`,
      ]) {
        expect(paths).not.toContain(excluded)
      }
      expect(result.warnings).toHaveLength(0)
    })

    it('Given the component has an extensionless file, When collect, Then copies the file named as the component', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValueOnce([])
      mockedPathExists.mockResolvedValueOnce(true)
      const ctx = getContext({ config })
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, ctx)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies).toContainEqual({
        kind: CopyOperationKind.GitCopy,
        path: COMPONENT_PATH,
        revision: config.to,
      })
      expect(mockedPathExists).toHaveBeenCalledWith(COMPONENT_PATH, ctx)
    })

    it('Given no file is named as the component, When collect, Then copies no file named as the component', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValueOnce([])
      mockedPathExists.mockResolvedValueOnce(false)
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies.map(c => c.path)).not.toContain(COMPONENT_PATH)
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
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
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

    it('Given type with uppercase suffix, When collect, Then folder meta file uses lowercase suffix', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const upperSuffixType = {
        ...objectType,
        suffix: 'Document',
      }
      const upperLine = `A       force-app/main/default/${upperSuffixType.directoryName}/${entity}.${extension}${METAFILE_SUFFIX}`
      const { changeType, element } = createElement(
        upperLine,
        upperSuffixType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      const folderMetaCopy = result.copies.find(
        c =>
          c.kind === CopyOperationKind.GitCopy &&
          c.path.endsWith('folder.document-meta.xml')
      )
      expect(folderMetaCopy).toBeDefined()
    })

    it('Given addition with generateDelta false, When collect, Then _shouldCollectCopies prevents special extension copies', async () => {
      // Arrange
      config.generateDelta = false
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result).length).toBeGreaterThan(0)
      expect(mockedReadDirs).not.toHaveBeenCalled()
      expect(mockedPathExists).not.toHaveBeenCalled()
    })

    it('Given file directly in type directory with non-matching extension, When collect, Then _isProcessable returns false and result is empty', async () => {
      // Arrange
      const nonMatchingLine = `A       force-app/main/default/${objectType.directoryName}/test.wrongExtension`
      const { changeType, element } = createElement(
        nonMatchingLine,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toHaveLength(0)
      expect(result.copies).toHaveLength(0)
    })

    it('Given element name with meta suffix, When collect, Then _getElementName strips META_REGEX', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const metaLine = `A       force-app/main/default/${objectType.directoryName}/folder/test.${extension}${METAFILE_SUFFIX}`
      const { changeType, element } = createElement(
        metaLine,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      const manifestMember = elementsOf(result).find(
        m => m.target === ManifestTarget.Package
      )?.member
      expect(manifestMember).toBeDefined()
      expect(manifestMember).not.toContain(METAFILE_SUFFIX)
      expect(manifestMember).not.toContain('-meta.xml')
    })

    it('Given element name with extension suffix, When collect, Then _getElementName strips EXTENSION_SUFFIX_REGEX', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      const manifestMember = elementsOf(result).find(
        m => m.target === ManifestTarget.Package
      )?.member
      expect(manifestMember).toBe(entity)
      expect(manifestMember).not.toMatch(/\.[^/.]+$/)
    })

    it('Given element name ending with Folder, When collect, Then _getElementName strips INFOLDER_SUFFIX_REGEX so member has no trailing Folder', async () => {
      // Arrange — a bare folder entry with no dot-extension so pathAfterType = ['myFolder']
      // _getElementName: join → "myFolder" → META_REGEX (no match) → INFOLDER_SUFFIX_REGEX strips trailing "Folder" → "my" → EXTENSION_SUFFIX_REGEX (no dot, no change) → "my"
      mockedReadDirs.mockResolvedValue([])
      const folderEntryLine = `A       force-app/main/default/${objectType.directoryName}/myFolder`
      const { changeType, element } = createElement(
        folderEntryLine,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      const manifestMember = elementsOf(result).find(
        m => m.target === ManifestTarget.Package
      )?.member
      expect(manifestMember).toBeDefined()
      // INFOLDER_SUFFIX_REGEX (/Folder$/) must strip "Folder" → member is "my", not "myFolder"
      expect(manifestMember).toBe('my')
    })

    it('Given element name containing meta suffix, When collect, Then _getElementName strips META_REGEX leaving no meta keyword', async () => {
      // Arrange — path whose joined pathAfterType contains the full -meta.xml token
      mockedReadDirs.mockResolvedValue([])
      const metaInNameLine = `A       force-app/main/default/${objectType.directoryName}/subfolder/item.documentFolder-meta.xml`
      const { changeType, element } = createElement(
        metaInNameLine,
        objectType,
        globalMetadata
      )
      const sut = new InFolder(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      const manifestMember = elementsOf(result).find(
        m => m.target === ManifestTarget.Package
      )?.member
      expect(manifestMember).toBeDefined()
      // META_REGEX must strip "-meta.xml" before EXTENSION_SUFFIX_REGEX runs;
      // without it the member would still contain "meta"
      expect(manifestMember).not.toContain('meta')
    })
  })
})
