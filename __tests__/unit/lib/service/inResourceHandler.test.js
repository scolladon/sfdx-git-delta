'use strict'
const InResourceHandler = require('../../../../src/service/inResourceHandler')
const {
  copyFiles,
  pathExists,
  readDir,
} = require('../../../../src/utils/fsHelper')
const { METAFILE_SUFFIX } = require('../../../../src/utils/metadataConstants')

jest.mock('../../../../src/utils/fsHelper')
jest.mock('fs-extra')
jest.mock('fs')

const objectType = 'staticresources'
const element = 'myResources'
const basePath = 'force-app/main/default/staticresources'
const entityPath = `${basePath}/${element}.js`
const line = `A       ${entityPath}`
const type = 'resource'
let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '' },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('InResourceHandler', () => {
  let globalMetadata
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
        expect(...work.diffs.package.get(objectType)).toEqual(element)
        expect(copyFiles).not.toBeCalled()
      })
    })

    describe('when generating delta', () => {
      beforeEach(() => {
        work.config.generateDelta = true
      })
      describe('when matching resource exist', () => {
        beforeEach(() => {
          readDir.mockImplementation(() =>
            Promise.resolve([
              'other.resource-meta.xml',
              'other/',
              'image.resource-meta.xml',
              'my_experience_bundle.site-meta.xml',
              'my_experience_bundle/',
              'other_experience_bundle.resource-meta.xml',
            ])
          )
        })
        it.each([
          ['staticresources', 'image', 'image.png', 3],
          ['staticresources', 'image', 'image/logo.png', 3],
          [
            'experiences',
            'my_experience_bundle',
            'my_experience_bundle/config/myexperiencebundle.json',
            5,
          ],
        ])(
          'should copy the matching folder resource, matching meta file and subject file',
          async (type, entity, path, expectedCount) => {
            // Arrange
            const base = 'force-app/main/default/'
            const line = `A       ${base}${type}/${path}`
            const sut = new InResourceHandler(line, type, work, globalMetadata)

            // Act
            await sut.handle()

            // Assert
            expect(...work.diffs.package.get(type)).toEqual(entity)
            expect(copyFiles).toBeCalledTimes(expectedCount)
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type}/${path}`
            )
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type}/${path}${METAFILE_SUFFIX}`
            )
            expect(copyFiles).toHaveBeenCalledWith(
              work.config,
              `${base}${type}/${entity}.${
                globalMetadata.get(type).suffix
              }${METAFILE_SUFFIX}`
            )
          }
        )

        it('should copy the matching lwc', async () => {
          // Arrange
          const type = 'lwc'
          const entity = 'lwcc'
          const path = 'lwcc/lwcc.js'
          const base = 'force-app/main/default/'
          const line = `A       ${base}${type}/${path}`
          const sut = new InResourceHandler(line, type, work, globalMetadata)

          // Act
          await sut.handle()

          // Assert
          expect(...work.diffs.package.get(type)).toEqual(entity)
          expect(copyFiles).toBeCalledTimes(1)
          expect(copyFiles).toHaveBeenCalledWith(
            work.config,
            `${base}${type}/${path}`
          )
        })
      })

      describe('when no matching resource exist', () => {
        it('should not copy resource files', async () => {
          // Arrange
          const sut = new InResourceHandler(
            line,
            objectType,
            work,
            globalMetadata
          )
          readDir.mockImplementationOnce(() => Promise.resolve([]))

          // Act
          await sut.handle()

          // Assert
          expect(...work.diffs.package.get(objectType)).toEqual(element)
          expect(copyFiles).toBeCalledTimes(2)
          expect(copyFiles).toHaveBeenCalledWith(work.config, `${entityPath}`)
          expect(copyFiles).not.toHaveBeenCalledWith(
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
    describe('When only a ressource sub element is deleted', () => {
      beforeEach(() => {
        pathExists.mockResolvedValue(true)
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
        expect(...work.diffs.package.get(objectType)).toEqual(element)
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining('resource'),
          work.config
        )
      })
    })
    describe('When the ressource is deleted', () => {
      beforeEach(() => {
        pathExists.mockResolvedValue(false)
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
        expect(work.diffs.package.has(objectType)).toBe(false)
        expect(...work.diffs.destructiveChanges.get(objectType)).toEqual(
          element
        )
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining(element),
          work.config
        )
      })
    })
  })

  describe('when the line should not be processed', () => {
    it.each([`${basePath}/.eslintrc.json`])(
      'does not handle the line',
      async entityPath => {
        // Arrange
        const sut = new InResourceHandler(
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
      }
    )
  })
})
