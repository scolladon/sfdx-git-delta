'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InResourceHandler from '../../../../src/service/inResourceHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, pathExists, readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

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
const elementName = 'myResources'
const basePath = 'force-app/main/default/staticresources'
const entityPath = `${basePath}/${elementName}.js`
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
    globalMetadata = await getDefinition({})
  })

  describe('When entity is added', () => {
    describe('when not generating delta', () => {
      beforeEach(() => {
        work.config.generateDelta = false
      })
      it('should not copy matching files', async () => {
        // Arrange
        const { changeType, element } = createElement(
          line,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, work)

        // Act
        await sut.handle()

        // Assert
        expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
          elementName,
        ])
        expect(copyFiles).not.toHaveBeenCalled()
      })

      it('Given file extension matches metadata suffix, When entity is added, Then uses last path segment for element name', async () => {
        // Arrange
        const resourceLine = `A       ${basePath}/${elementName}.${type}`
        const { changeType, element } = createElement(
          resourceLine,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, work)

        // Act
        await sut.handle()

        // Assert
        expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
          elementName,
        ])
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
        const { changeType, element } = createElement(
          line,
          lwcType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, work)

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
        it('should copy lwc bundle folder and its files (and exclude not matching files)', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'myComponent'
          const path = `${entity}/${entity}.js`
          const line = `A       ${base}${lwcType.directoryName}/${path}`
          mockedReadDirs.mockResolvedValue([
            `${base}${lwcType.directoryName}/${entity}/${entity}.js`,
            `${base}${lwcType.directoryName}/${entity}/${entity}.css`,
            `${base}${lwcType.directoryName}/${entity}/${entity}.html`,
            `${base}${lwcType.directoryName}/${entity}/${entity}.js-meta.xml`,
            `${base}${lwcType.directoryName}/myComponentForExperienceCloud/`,
            `${base}${lwcType.directoryName}/myComponentForExperienceCloud/myComponentForExperienceCloud.js`,
          ])
          const { changeType, element } = createElement(
            line,
            lwcType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, work)

          // Act
          await sut.handle()

          // Assert
          expect(Array.from(work.diffs.package.get(lwcType.xmlName)!)).toEqual([
            entity,
          ])
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${lwcType.directoryName}/${path}`
          )
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${lwcType.directoryName}/${entity}/${entity}.js-meta.xml`
          )
          expect(copyFiles).not.toHaveBeenCalledWith(
            work.config,
            expect.stringContaining('myComponentForExperienceCloud')
          )
        })

        it('should copy static resource file and its meta at same level', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'imageFile'
          const path = `${entity}.png`
          const line = `A       ${base}${staticResourceType.directoryName}/${path}`
          mockedReadDirs.mockResolvedValue([
            `${base}${staticResourceType.directoryName}/${entity}.resource-meta.xml`,
            `${base}${staticResourceType.directoryName}/other.resource-meta.xml`,
          ])
          const { changeType, element } = createElement(
            line,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, work)

          // Act
          await sut.handle()

          // Assert
          expect(
            Array.from(work.diffs.package.get(staticResourceType.xmlName)!)
          ).toEqual([entity])
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${staticResourceType.directoryName}/${path}`
          )
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${staticResourceType.directoryName}/${entity}.${staticResourceType.suffix}${METAFILE_SUFFIX}`
          )
        })

        it('should copy static resource folder content and its meta', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'imageFolder'
          const path = `${entity}/logo.png`
          const line = `A       ${base}${staticResourceType.directoryName}/${path}`
          mockedReadDirs.mockResolvedValue([
            `${base}${staticResourceType.directoryName}/${entity}.${staticResourceType.suffix}${METAFILE_SUFFIX}`,
          ])
          const { changeType, element } = createElement(
            line,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, work)

          // Act
          await sut.handle()

          // Assert
          expect(
            Array.from(work.diffs.package.get(staticResourceType.xmlName)!)
          ).toEqual([entity])
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${staticResourceType.directoryName}/${path}`
          )
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${staticResourceType.directoryName}/${entity}.${staticResourceType.suffix}${METAFILE_SUFFIX}`
          )
        })

        it('should copy experience bundle with site meta and contained files', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'my_experience_bundle'
          const path = `${entity}/config/myexperiencebundle.json`
          const line = `A       ${base}${experienceBundleType.directoryName}/${path}`
          mockedReadDirs.mockResolvedValue([
            `${base}${experienceBundleType.directoryName}/${entity}.site-meta.xml`,
            `${base}${experienceBundleType.directoryName}/${entity}/config/myexperiencebundle.json`,
            `${base}${experienceBundleType.directoryName}/other_experience_bundle.resource-meta.xml`,
          ])
          const { changeType, element } = createElement(
            line,
            experienceBundleType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, work)

          // Act
          await sut.handle()

          // Assert
          expect(
            Array.from(work.diffs.package.get(experienceBundleType.xmlName)!)
          ).toEqual([entity])
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${experienceBundleType.directoryName}/${path}`
          )
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${experienceBundleType.directoryName}/${entity}.${experienceBundleType.suffix}${METAFILE_SUFFIX}`
          )
        })
      })

      describe('when no matching resource exist', () => {
        it('should try copy resource files', async () => {
          // Arrange
          const { changeType, element } = createElement(
            line,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, work)
          mockedReadDirs.mockResolvedValueOnce([])

          // Act
          await sut.handle()

          // Assert
          expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
            elementName,
          ])
          expect(copyFiles).toHaveBeenCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(work.config, `${entityPath}`)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${basePath}.${type}${METAFILE_SUFFIX}`
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
        const { changeType, element } = createElement(
          `D       ${entityPath}`,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, work)

        // Act
        await sut.handle()

        // Assert
        expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
          elementName,
        ])
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
        const { changeType, element } = createElement(
          `D       ${entityPath}`,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, work)

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.has(xmlName)).toBe(false)
        expect(Array.from(work.diffs.destructiveChanges.get(xmlName)!)).toEqual(
          [elementName]
        )
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining('staticresources'),
          work.config
        )
      })
    })
  })
})
