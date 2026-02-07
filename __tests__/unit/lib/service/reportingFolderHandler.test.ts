'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ReportingFolderHandler from '../../../../src/service/reportingFolderHandler'
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

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  mockedReadDirs.mockResolvedValue([])
})

describe('InNestedFolderHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe.each(
    testContext
  )('when called with generateDelta false', (changePath: string, expectedMember: string, expectedType: string) => {
    beforeEach(() => {
      work.config.generateDelta = false
    })
    it(`should add manifest entry when adding ${expectedType}`, async () => {
      // Arrange
      const { changeType, element } = createElement(
        changePath,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(changeType, element, work)

      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: expectedType,
            member: expectedMember,
          }),
        ])
      )
    })
  })

  describe.each(
    testContext
  )('when called with generateDelta true', (changePath: string, expectedMember: string, expectedType: string) => {
    beforeEach(() => {
      work.config.generateDelta = true
    })

    describe(`when readDirs does not return files`, () => {
      it(`should return manifest and copy entries for ${expectedType}`, async () => {
        // Arrange
        const { changeType, element } = createElement(
          changePath,
          objectType,
          globalMetadata
        )
        const sut = new ReportingFolderHandler(changeType, element, work)
        mockedReadDirs.mockImplementation(() => Promise.resolve([]))

        // Act
        const result = await sut.collectAddition()

        // Assert
        expect(result.manifests).toEqual(
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
        const sut = new ReportingFolderHandler(changeType, element, work)
        mockedReadDirs.mockImplementationOnce(() =>
          Promise.resolve([entity, 'not/matching'])
        )

        // Act
        const result = await sut.collectAddition()

        // Assert
        expect(result.manifests).toEqual(
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
  })

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
      const sut = new ReportingFolderHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
    })
  })

  describe('when extension has no matching type in sharedFolderMetadata', () => {
    it('should not add to package but still process the line', async () => {
      // Arrange
      const nestedPath = `force-app/main/default/${objectType.directoryName}/subfolder/test.unknownext-meta.xml`
      work.config.generateDelta = false
      const { changeType, element } = createElement(
        `A       ${nestedPath}`,
        objectType,
        globalMetadata
      )
      const sut = new ReportingFolderHandler(changeType, element, work)

      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(result.manifests).toEqual([])
    })
  })
})
