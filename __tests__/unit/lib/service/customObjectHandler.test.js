'use strict'
const CustomObjectHandler = require('../../../../src/service/customObjectHandler')
const { MASTER_DETAIL_TAG } = require('../../../../src/utils/metadataConstants')
const {
  copyFiles,
  pathExists,
  readDir,
  readPathFromGit,
} = require('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/fsHelper')

pathExists.mockImplementation(() => Promise.resolve(true))

const objectType = 'objects'
const line =
  'A       force-app/main/default/objects/Account/Account.object-meta.xml'

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('CustomObjectHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new CustomObjectHandler(
        line,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(pathExists).not.toBeCalled()
    })
  })

  describe('when called with generateDelta true', () => {
    describe(`when called with not 'objects' type`, () => {
      it('should not handle try to find master details fields', async () => {
        // Arrange
        const sut = new CustomObjectHandler(
          'A       force-app/main/default/territory2Models/EU/EU.territory2Model-meta.xml',
          'territory2Models',
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(pathExists).not.toBeCalled()
      })
    })

    describe('when field folder exist', () => {
      describe('when field folder contains master details', () => {
        it('should copy master detail fields', async () => {
          // Arrange
          readDir.mockImplementationOnce(() => ['Name.field-meta.xml'])
          readPathFromGit.mockImplementationOnce(() => MASTER_DETAIL_TAG)
          const sut = new CustomObjectHandler(
            line,
            objectType,
            work,
            globalMetadata
          )

          // Act
          await sut.handleAddition()

          // Assert
          expect(copyFiles).toBeCalledTimes(2)
        })
      })

      describe('when field folder does not contain master details', () => {
        it('should not copy master detail fields', async () => {
          // Arrange
          readDir.mockImplementation(() => [])
          readPathFromGit.mockImplementationOnce(() => '')
          const sut = new CustomObjectHandler(
            line,
            objectType,
            work,
            globalMetadata
          )

          // Act
          await sut.handleAddition()

          // Assert
          expect(copyFiles).toBeCalledTimes(1)
        })
      })
    })

    describe('when field folder does not exist', () => {
      it('should not look into the field folder', async () => {
        // Arrange
        pathExists.mockImplementationOnce(() => Promise.resolve(false))
        const sut = new CustomObjectHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readDir).not.toBeCalled()
      })
    })
  })
})
