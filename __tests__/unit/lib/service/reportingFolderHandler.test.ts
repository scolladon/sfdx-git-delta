'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ReportingFolderHandler from '../../../../src/service/reportingFolderHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { readDirs } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = vi.mocked(readDirs)

const entity = 'folder/test'
const extension = 'report'
const objectType = {
  directoryName: 'reports',
  inFolder: true,
  metaFile: true,
  xmlName: 'Report',
  content: [
    {
      suffix: 'report',
      xmlName: 'Report',
    },
    {
      suffix: 'reportFolder',
      xmlName: 'ReportFolder',
    },
  ],
}

const testContext = [
  [
    `A       force-app/main/default/${objectType.directoryName}/${entity}.${extension}-meta.xml`,
    entity,
    'Report',
  ],
  [
    `A       force-app/main/default/${objectType.directoryName}/${entity}.reportFolder-meta.xml`,
    entity,
    'ReportFolder',
  ],
  [
    `A       force-app/main/default/${objectType.directoryName}/folder/${entity}.reportFolder-meta.xml`,
    `folder/${entity}`,
    'ReportFolder',
  ],
  [
    `A       force-app/main/default/${objectType.directoryName}/folder/folder/${entity}.reportFolder-meta.xml`,
    `folder/folder/${entity}`,
    'ReportFolder',
  ],
]

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
  mockedReadDirs.mockResolvedValue([])
})

describe('InNestedFolderHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe.each(testContext)(
    'when called with generateDelta false',
    (changePath: string, expectedMember: string, expectedType: string) => {
      beforeEach(() => {
        config.generateDelta = false
      })
      it(`should add manifest entry when adding ${expectedType}`, async () => {
        // Arrange
        const { changeType, element } = createElement(
          changePath,
          objectType,
          globalMetadata
        )
        const sut = new ReportingFolderHandler(
          changeType,
          element,
          getContext({ config })
        )

        // Act
        const result = await sut.collectAddition()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: expectedType,
              member: expectedMember,
            }),
          ])
        )
      })
    }
  )

  describe.each(testContext)(
    'when called with generateDelta true',
    (changePath: string, expectedMember: string, expectedType: string) => {
      beforeEach(() => {
        config.generateDelta = true
      })

      describe(`when readDirs does not return files`, () => {
        it(`should return manifest and copy entries for ${expectedType}`, async () => {
          // Arrange
          const { changeType, element } = createElement(
            changePath,
            objectType,
            globalMetadata
          )
          const sut = new ReportingFolderHandler(
            changeType,
            element,
            getContext({ config })
          )
          mockedReadDirs.mockImplementation(() => Promise.resolve([]))

          // Act
          const result = await sut.collectAddition()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: expectedType,
                member: expectedMember,
              }),
            ])
          )
          expect(readDirs).toHaveBeenCalledTimes(1)
          expect(result.copies).toHaveLength(3)
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
              }),
            ])
          )
        })
      })

      describe('when readDirs returns files', () => {
        it('should include special extension copies', async () => {
          // Arrange
          const { changeType, element } = createElement(
            changePath,
            objectType,
            globalMetadata
          )
          const sut = new ReportingFolderHandler(
            changeType,
            element,
            getContext({ config })
          )
          mockedReadDirs.mockImplementationOnce(() =>
            Promise.resolve([entity, 'not/matching'])
          )

          // Act
          const result = await sut.collectAddition()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: expectedType,
                member: expectedMember,
              }),
            ])
          )
          expect(readDirs).toHaveBeenCalledTimes(1)
          expect(result.copies).toHaveLength(5)
        })
      })
    }
  )

  describe('when the line should not be processed', () => {
    it.each([
      `force-app/main/default/${objectType.directoryName}/test.otherExtension`,
    ])('does not handle the line', async entityPath => {
      // Arrange
      const { changeType, element } = createElement(
        `A       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual([])
      expect(result.copies).toEqual([])
    })
  })

  describe('when extension has no matching type in sharedFolderMetadata', () => {
    it('should not add to package but still process the line', async () => {
      // Arrange
      const nestedPath = `force-app/main/default/${objectType.directoryName}/subfolder/test.unknownext-meta.xml`
      config.generateDelta = false
      const { changeType, element } = createElement(
        `A       ${nestedPath}`,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(elementsOf(result)).toEqual([])
    })

    it('should throw when getElementDescriptor is called directly (kills L42 NoCoverage defensive guard)', async () => {
      // Arrange — TypeHandlerFactory only ever routes to ReportingFolderHandler
      // via a resolvable extension, so getElementDescriptor's guard is
      // unreachable through the normal call chain; still a genuine safety
      // net that must fail loudly rather than returning a bogus descriptor.
      const nestedPath = `force-app/main/default/${objectType.directoryName}/subfolder/test.unknownext-meta.xml`
      const { changeType, element } = createElement(
        `A       ${nestedPath}`,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act & Assert
      expect(() => sut.getElementDescriptor()).toThrow(
        `ReportingFolderHandler: resolvedType is missing for ${element.fullPath}`
      )
    })
  })

  describe('collectDeletion', () => {
    it('should return destructive manifest entry when extension matches', async () => {
      // Arrange
      config.generateDelta = false
      const deletionPath = `D       force-app/main/default/${objectType.directoryName}/${entity}.${extension}-meta.xml`
      const { changeType, element } = createElement(
        deletionPath,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collectDeletion()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'Report',
            member: entity,
          }),
        ])
      )
    })

    it('should return empty result when extension has no matching type', async () => {
      // Arrange
      config.generateDelta = false
      const unknownPath = `D       force-app/main/default/${objectType.directoryName}/subfolder/test.unknownext-meta.xml`
      const { changeType, element } = createElement(
        unknownPath,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const result = await sut.collectDeletion()

      // Assert
      expect(elementsOf(result)).toEqual([])
      expect(result.copies).toEqual([])
    })
  })
})
