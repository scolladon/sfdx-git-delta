'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import InResourceHandler from '../../../../src/service/inResourceHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, pathExists, readDirs } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadDirs = jest.mocked(readDirs)
const mockedPathExists = jest.mocked(pathExists)

const lwcType = {
  directoryName: 'lwc',
  inFolder: false,
  metaFile: false,
  suffix: '',
  xmlName: 'LightningComponentBundle',
}

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
        expect(copyFiles).not.toHaveBeenCalled()
      })

      it('should correctly identify component name in deeply nested metadata kind folder structure', async () => {
        // Arrange
        const lwcType = {
          directoryName: 'lwc',
          inFolder: false,
          metaFile: false,
          xmlName: 'LightningComponentBundle',
          element: 'deeplyNestedComponent',
        }
        const nestedPath = `force-app/main/default/lwc/sub_folder1/lwc/${lwcType.element}/${lwcType.element}.js`
        const line = `A       ${nestedPath}`
        const sut = new InResourceHandler(line, lwcType, work, globalMetadata)

        // Act
        await sut.handle()

        // Assert
        expect(Array.from(work.diffs.package.get(lwcType.xmlName)!)).toEqual([
          lwcType.element,
        ])
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when generating delta', () => {
      beforeEach(() => {
        work.config.generateDelta = true
      })
      describe('when matching resource exist', () => {
        it.each([
          ['myComponent.js', lwcType, 'myComponent', 6],
          ['imageFile.png', staticResourceType, 'imageFile', 2],
          ['imageFolder/logo.png', staticResourceType, 'imageFolder', 2],
          [
            'my_experience_bundle/config/myexperiencebundle.json',
            experienceBundleType,
            'my_experience_bundle',
            4,
          ],
        ])(
          'should copy the matching folder resource, matching meta file and subject file %s',
          async (path, type, entity, expectedCopyCount) => {
            // Arrange
            const base = 'force-app/main/default/'
            const line = `A       ${base}${type.directoryName}/${path}`
            mockedReadDirs.mockResolvedValue([
              `${base}${type.directoryName}/other.resource-meta.xml`,
              `${base}${type.directoryName}/myComponent/myComponent.js`,
              `${base}${type.directoryName}/myComponent/myComponent.css`,
              `${base}${type.directoryName}/myComponent/myComponent.html`,
              `${base}${type.directoryName}/myComponent/myComponent.js-meta.xml`,
              `${base}${type.directoryName}/myComponentForExperienceCloud/`,
              `${base}${type.directoryName}/myComponentForExperienceCloud/myComponentForExperienceCloud.js`,
              `${base}${type.directoryName}/myComponentForExperienceCloud/myComponentForExperienceCloud.css`,
              `${base}${type.directoryName}/myComponentForExperienceCloud/myComponentForExperienceCloud.html`,
              `${base}${type.directoryName}/myComponentForExperienceCloud/myComponentForExperienceCloud.js-meta.xml`,
              `${base}${type.directoryName}/image.resource-meta.xml`,
              `${base}${type.directoryName}/my_experience_bundle.site-meta.xml`,
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
            expect(copyFiles).toHaveBeenCalledTimes(expectedCopyCount)
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
          const entity = 'lwcc'
          const path = 'lwcc/lwcc.js'
          const base = 'force-app/main/default/'
          const line = `A       ${base}${lwcType.directoryName}/${path}`
          const sut = new InResourceHandler(line, lwcType, work, globalMetadata)

          // Act
          await sut.handle()

          // Assert
          expect(work.diffs.package.get(lwcType.xmlName)).toEqual(
            new Set([entity])
          )
          expect(copyFiles).toHaveBeenCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${lwcType.directoryName}/${path}`
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
          mockedReadDirs.mockResolvedValueOnce([])

          // Act
          await sut.handle()

          // Assert
          expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
            element,
          ])
          expect(copyFiles).toHaveBeenCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(work.config, `${entityPath}`)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${basePath}/${element}.${type}${METAFILE_SUFFIX}`
          )
        })
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
