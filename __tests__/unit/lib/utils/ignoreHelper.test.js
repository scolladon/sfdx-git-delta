const {
  forPath,
  buildIgnoreHelper,
} = require('../../../../src/utils/ignoreHelper')
const { readFile } = require('../../../../src/utils/fsHelper')
const {
  ADDITION,
  MODIFICATION,
  DELETION,
} = require('../../../../src/utils/gitConstants')
jest.mock('../../../../src/utils/fsHelper')

describe('ignoreHelper', () => {
  beforeEach(() => {})
  describe('forPath', () => {
    describe('when path exist', () => {
      it('returns an ignore instance', async () => {
        // Arrange
        expect.assertions(2)
        readFile.mockImplementationOnce(() => {
          return ''
        })

        // Act
        const actual = await forPath('.forceignore')

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
        const expected = await forPath(ignorePath)

        // Act
        const actual = await forPath(ignorePath)

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
          actual = await forPath('.notexist')
        } catch (e) {
          // Assert
          expect(actual).toBeFalsy()
          expect(readFile).toHaveBeenCalledTimes(1)
        }
      })
    })
  })

  describe('buildIgnoreHelper', () => {
    describe('when config does not have ignore neither destructive ignore', () => {
      let sut
      beforeAll(async () => {
        // Arrange
        const config = {}
        sut = await buildIgnoreHelper(config)
      })

      it('helper should not have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeUndefined()
      })

      it('helper should not have destructiveInstance', () => {
        // Assert
        expect(sut.destructiveIgnore).toBeUndefined()
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
        `${DELETION} path/to/file.ext`,
        `! path/to/file.ext`,
      ])('should keep "%s" line', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config does not have ignore and have destructive ignore', () => {
      let sut
      beforeAll(async () => {
        // Arrange
        readFile.mockImplementationOnce(() => Promise.resolve('*ignoreFile*'))
        const config = { ignoreDestructive: 'path' }
        sut = await buildIgnoreHelper(config)
      })

      it('helper should not have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeUndefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut.destructiveIgnore).toBeDefined()
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])(
        'should keep deleted "%s" line not matching ignoreDestructive pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(true)
        }
      )

      it.each([`${DELETION} path/to/ignoreFile.ext`])(
        'should not keep deleted "%s" line matching ignoreDestructive pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })
    })
    describe('when config has ignore and does not have destructive ignore', () => {
      let sut
      beforeAll(async () => {
        // Arrange
        readFile.mockImplementationOnce(() => Promise.resolve('*ignoreFile*'))
        const config = { ignore: 'path' }
        sut = await buildIgnoreHelper(config)
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance (same as globalInstance)', () => {
        // Assert
        expect(sut.destructiveIgnore).toBeDefined()
        expect(sut.destructiveIgnore).toStrictEqual(sut.globalIgnore)
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/ignoreFile.ext`,
        `${MODIFICATION} path/to/ignoreFile.ext`,
      ])('should not keep changed "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
        `${DELETION} anotherPath/to/ignoreFile.ext`,
        `${DELETION} path/to/anotherignoreFile.ext`,
      ])('should not keep deleted "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })
    })
    describe('when config has ignore and destructive ignore', () => {
      let sut
      beforeAll(async () => {
        // Arrange
        readFile.mockImplementationOnce(() => Promise.resolve('*ignoreFile*'))
        readFile.mockImplementationOnce(() => Promise.resolve('*ignoreFile*'))
        const config = { ignore: 'path', ignoreDestructive: 'otherPath' }
        sut = await buildIgnoreHelper(config)
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance', () => {
        // Assert
        expect(sut.destructiveIgnore).toBeDefined()
      })

      it.each([
        `${ADDITION} path/to/file.ext`,
        `${MODIFICATION} path/to/file.ext`,
      ])('should keep changed "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${ADDITION} path/to/ignoreFile.ext`,
        `${MODIFICATION} path/to/ignoreFile.ext`,
      ])('should not keep changed "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })

      it.each([
        `${DELETION} path/to/file.ext`,
        `${DELETION} anotherPath/to/file.ext`,
        `${DELETION} path/to/anotherFile.ext`,
      ])('should keep deleted "%s" line not matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(true)
      })

      it.each([
        `${DELETION} path/to/ignoreFile.ext`,
        `${DELETION} anotherPath/to/ignoreFile.ext`,
        `${DELETION} path/to/anotherignoreFile.ext`,
      ])('should not keep deleted "%s" line matching ignore pattern', line => {
        // Act
        const keep = sut.keep(line)

        // Assert
        expect(keep).toBe(false)
      })
    })
  })
})
