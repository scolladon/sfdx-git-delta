'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import InResourceHandler from '../../../../src/service/inResourceHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, pathExists, readDir } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadDir = jest.mocked(readDir)
const mockedPathExists = jest.mocked(pathExists)

const staticResourceType = {
  directoryName: 'staticresources',
  inFolder: false,
  metaFile: true,
  suffix: 'resource',
  xmlName: 'StaticResource',
}
const experienceBundleType = {
  directoryName: 'experiences',
  inFolder: false,
  metaFile: true,
  suffix: 'site',
  xmlName: 'ExperienceBundle',
}
const permissionSetType = {
  directoryName: 'permissionsets',
  inFolder: false,
  metaFile: false,
  suffix: 'permissionset',
  xmlName: 'PermissionSet',
}
const element = 'myResources'
const basePath = 'force-app/main/default/staticresources'
const entityPath = `${basePath}/${element}.js`
const xmlName = 'StaticResource'
const line = `A       ${entityPath}`
const type = 'resource'
let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('InResourceHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getGlobalMetadata()
  })

  describe('When entity is added', () => {
    describe('when not generating delta', () => {
      beforeEach(() => {
        work.config.generateDelta = false
      })
      it('should not copy matching files', async () => {
        // Arrange
        const sut = new InResourceHandler(
          line,
          staticResourceType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([element])
        expect(copyFiles).not.toBeCalled()
      })
    })

    describe('when generating delta', () => {
      beforeEach(() => {
        work.config.generateDelta = true
      })
      describe('when matching resource exist', () => {
        it.each([
          ['imageFile.png', staticResourceType, 'imageFile', 2],
          ['imageFolder/logo.png', staticResourceType, 'imageFolder', 2],
          [
            'my_experience_bundle/config/myexperiencebundle.json',
            experienceBundleType,
            'my_experience_bundle',
            5,
          ],
          [
            'CustomerSupport/permissionSetFieldPermissions/Account.Test__c.permissionSetFieldPermission-meta.xml',
            permissionSetType,
            'CustomerSupport',
            2,
          ],
        ])(
          'should copy the matching folder resource, matching meta file and subject file %s',
          async (path, type, entity, expectedCopyCount) => {
            // Arrange
            const base = 'force-app/main/default/'
            const line = `A       ${base}${type.directoryName}/${path}`
            mockedReadDir.mockResolvedValue([
              `${base}${type.directoryName}/other.resource-meta.xml`,
              `${base}${type.directoryName}/other/`,
              `${base}${type.directoryName}/image.resource-meta.xml`,
              `${base}${type.directoryName}/my_experience_bundle.site-meta.xml`,
              `${base}${type.directoryName}/my_experience_bundle/`,
              `${base}${type.directoryName}/my_experience_bundle/config/myexperiencebundle.json`,
              `${base}${type.directoryName}/other_experience_bundle.resource-meta.xml`,
            ])
            const sut = new InResourceHandler(line, type, work, globalMetadata)

            // Act
            await sut.handle()

            // Assert
            expect(Array.from(work.diffs.package.get(type.xmlName)!)).toEqual([
              entity,
            ])
            expect(copyFiles).toBeCalledTimes(expectedCopyCount)
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type.directoryName}/${path}`
            )
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type.directoryName}/${entity}.${type.suffix}${METAFILE_SUFFIX}`
            )
          }
        )

        it('should copy the matching lwc', async () => {
          // Arrange
          const type = {
            directoryName: 'lwc',
            inFolder: false,
            metaFile: false,
            xmlName: 'LightningComponentBundle',
          }
          const entity = 'lwcc'
          const path = 'lwcc/lwcc.js'
          const base = 'force-app/main/default/'
          const line = `A       ${base}${type.directoryName}/${path}`
          const sut = new InResourceHandler(line, type, work, globalMetadata)

          // Act
          await sut.handle()

          // Assert
          expect(work.diffs.package.get(type.xmlName)).toEqual(
            new Set([entity])
          )
          expect(copyFiles).toBeCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${type.directoryName}/${path}`
          )
        })
      })

      describe('when no matching resource exist', () => {
        it('should try copy resource files', async () => {
          // Arrange
          const sut = new InResourceHandler(
            line,
            staticResourceType,
            work,
            globalMetadata
          )
          mockedReadDir.mockResolvedValueOnce([])

          // Act
          await sut.handle()

          // Assert
          expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
            element,
          ])
          expect(copyFiles).toBeCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(work.config, `${entityPath}`)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${basePath}/${element}.${type}${METAFILE_SUFFIX}`
          )
        })
      })
    })

    describe('when outside its folder', () => {
      it('should match via the extension', async () => {
        // Arrange
        const metadataElement = `MarketingUser`
        const path = `force-app/main/default/wrongFolder/${metadataElement}.permissionset-meta.xml`
        const line = `A  ${path}`

        const sut = new InResourceHandler(
          line,
          permissionSetType,
          work,
          globalMetadata
        )
        mockedReadDir.mockResolvedValueOnce([])

        // Act
        await sut.handle()

        // Assert
        expect(
          Array.from(work.diffs.package.get(permissionSetType.xmlName)!)
        ).toEqual([metadataElement])
        expect(copyFiles).toBeCalledTimes(2)
        expect(copyFiles).toHaveBeenCalledWith(work.config, path)
      })
    })
  })

  describe('When entity is deleted', () => {
    beforeEach(() => {
      work.config.generateDelta = false
    })
    describe('When only a resource sub element is deleted', () => {
      beforeEach(() => {
        mockedPathExists.mockResolvedValue(true)
      })
      it('should treat it as a modification', async () => {
        // Arrange
        const sut = new InResourceHandler(
          `D       ${entityPath}`,
          staticResourceType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([element])
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining('resource'),
          work.config
        )
      })
    })
    describe('When the resource is deleted', () => {
      beforeEach(() => {
        mockedPathExists.mockResolvedValue(false)
      })
      it('should treat it as a deletion', async () => {
        // Arrange
        const sut = new InResourceHandler(
          `D       ${entityPath}`,
          staticResourceType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.has(xmlName)).toBe(false)
        expect(Array.from(work.diffs.destructiveChanges.get(xmlName)!)).toEqual(
          [element]
        )
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining(element),
          work.config
        )
      })
    })
  })
})
