'use strict'
const SubCustomObjectHandler = require('../../../../src/service/subCustomObjectHandler')
const { MASTER_DETAIL_TAG } = require('../../../../src/utils/metadataConstants')
const { readPathFromGit, copyFiles } = require('../../../../src/utils/fsHelper')

jest.mock('../../../../src/utils/fsHelper')

const objectType = 'fields'
const line =
  'A       force-app/main/default/objects/Account/fields/awesome.field-meta.xml'

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('SubCustomObjectHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new SubCustomObjectHandler(
        line,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(readPathFromGit).not.toBeCalled()
    })
  })
  describe('when called with generateDelta true', () => {
    describe(`when field is not master detail`, () => {
      it('should not handle master detail exception', async () => {
        // Arrange
        const sut = new SubCustomObjectHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toBeCalledTimes(1)
        expect(copyFiles).toBeCalledTimes(1)
      })
    })
    describe(`when field is master detail`, () => {
      it('should copy the parent object', async () => {
        // Arrange
        readPathFromGit.mockImplementationOnce(() => MASTER_DETAIL_TAG)
        const sut = new SubCustomObjectHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(readPathFromGit).toBeCalledTimes(1)
        expect(copyFiles).toBeCalledTimes(2)
      })
    })
  })
})
