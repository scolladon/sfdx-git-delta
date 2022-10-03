const IgnoreHelper = require('../../../../src/utils/ignoreHelper')
const { readFile } = require('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/fsHelper', () => ({
  readFile: jest.fn(),
}))

describe('ignoreHelper', () => {
  let sut
  beforeEach(() => {
    sut = new IgnoreHelper()
  })
  describe('forPath', () => {
    describe('when path exist', () => {
      it('returns an ignore instance', async () => {
        // Arrange
        expect.assertions(2)
        readFile.mockImplementationOnce(() => {
          return ''
        })

        // Act
        const actual = await sut.forPath('.forceignore')

        // Assert
        expect(actual).toBeTruthy()
        expect(readFile).toHaveBeenCalledTimes(1)
      })
    })

    describe('when path is asked multiple times', () => {
      it('returns the same ignore instance', async () => {
        // Arrange
        expect.assertions(3)
        const ignorePath = '.ignore'
        readFile.mockImplementationOnce(() => {
          return ''
        })
        const expected = await sut.forPath(ignorePath)

        // Act
        const actual = await sut.forPath(ignorePath)

        // Assert
        expect(actual).toBeTruthy()
        expect(expected).toBe(actual)
        expect(readFile).toHaveBeenCalledTimes(1)
      })
    })

    describe('when path does not exist', () => {
      it('throws exception', async () => {
        // Arrange
        expect.assertions(2)
        readFile.mockRejectedValue(new Error())

        // Act
        let actual
        try {
          actual = await sut.forPath('.notexist')
        } catch (e) {
          // Assert
          expect(actual).toBeFalsy()
          expect(readFile).toHaveBeenCalledTimes(1)
        }
      })
    })
  })
})
