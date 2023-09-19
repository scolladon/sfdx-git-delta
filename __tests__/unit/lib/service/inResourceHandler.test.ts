'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import InResourceHandler from '../../../../src/service/inResourceHandler'
import { Work } from '../../../../src/types/work'
import { copyFiles, pathExists, readDir } from '../../../../src/utils/fsHelper'
import { METAFILE_SUFFIX } from '../../../../src/utils/metadataConstants'
import { MetadataRepository } from '../../../../src/types/metadata'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadDir = jest.mocked(readDir)
const mockedPathExists = jest.mocked(pathExists)

const objectType = 'staticresources'
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
    // eslint-disable-next-line no-undef
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
          objectType,
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
        beforeEach(() => {
          mockedReadDir.mockResolvedValue([
            'other.resource-meta.xml',
            'other/',
            'image.resource-meta.xml',
            'my_experience_bundle.site-meta.xml',
            'my_experience_bundle/',
            'other_experience_bundle.resource-meta.xml',
          ])
        })
        it.each([
          [
            'imageFile.png',
            'staticresources',
            'StaticResource',
            'imageFile',
            2,
          ],
          [
            'imageFolder/logo.png',
            'staticresources',
            'StaticResource',
            'imageFolder',
            3,
          ],
          [
            'my_experience_bundle/config/myexperiencebundle.json',
            'experiences',
            'ExperienceBundle',
            'my_experience_bundle',
            3,
          ],
        ])(
          'should copy the matching folder resource, matching meta file and subject file %s',
          async (path, type, xmlName, entity, expectedCopyCount) => {
            // Arrange
            const base = 'force-app/main/default/'
            const line = `A       ${base}${type}/${path}`
            const sut = new InResourceHandler(line, type, work, globalMetadata)

            // Act
            await sut.handle()

            // Assert
            expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([
              entity,
            ])
            expect(copyFiles).toBeCalledTimes(expectedCopyCount)
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type}/${path}`
            )
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type}/${entity}.${
                globalMetadata.get(type)!.suffix
              }${METAFILE_SUFFIX}`
            )
          }
        )

        it('should copy the matching lwc', async () => {
          // Arrange
          const type = 'lwc'
          const xmlName = 'LightningComponentBundle'
          const entity = 'lwcc'
          const path = 'lwcc/lwcc.js'
          const base = 'force-app/main/default/'
          const line = `A       ${base}${type}/${path}`
          const sut = new InResourceHandler(line, type, work, globalMetadata)

          // Act
          await sut.handle()

          // Assert
          expect(Array.from(work.diffs.package.get(xmlName)!)).toEqual([entity])
          expect(copyFiles).toBeCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${type}/${path}`
          )
        })
      })

      describe('when no matching resource exist', () => {
        it('should try copy resource files', async () => {
          // Arrange
          const sut = new InResourceHandler(
            line,
            objectType,
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
          objectType,
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
          objectType,
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
