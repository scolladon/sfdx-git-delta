const {
  buildIgnoreHelper,
  resetInstance,
} = require('../../../../src/utils/ignoreHelper')
const { readFile } = require('../../../../src/utils/fsHelper')
const {
  ADDITION,
  MODIFICATION,
  DELETION,
} = require('../../../../src/utils/gitConstants')
jest.mock('../../../../src/utils/fsHelper')

describe('ignoreHelper', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })
  describe('buildIgnoreHelper', () => {
    describe('when config does not have ignore neither destructive ignore', () => {
      let sut
      beforeAll(async () => {
        // Arrange
        const config = {}
        sut = await buildIgnoreHelper(config)
      })
      afterAll(() => {
        resetInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
        // Assert
        expect(sut.destructiveIgnore).toBeDefined()
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
        readFile.mockImplementation(() => Promise.resolve('*ignoreFile*'))
        const config = { ignoreDestructive: 'path' }
        sut = await buildIgnoreHelper(config)
      })

      afterAll(() => {
        resetInstance()
      })

      it('global helper should be defined', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('destructive helper should be defined', () => {
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
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])(
        'should not keep deleted "%s" line matching default ignore pattern',
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
        readFile.mockImplementation(() => Promise.resolve('*ignoreFile*'))
        const config = { ignore: 'path' }
        sut = await buildIgnoreHelper(config)
      })

      afterAll(() => {
        resetInstance()
      })

      it('helper should have globalInstance', () => {
        // Assert
        expect(sut.globalIgnore).toBeDefined()
      })

      it('helper should have destructiveInstance (with default ignore)', () => {
        // Assert
        expect(sut.destructiveIgnore).toBeDefined()
        expect(sut.destructiveIgnore._rules).toHaveLength(2)
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

      it.each([
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])(
        'should not keep deleted "%s" line matching default ignore pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )
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

      afterAll(() => {
        resetInstance()
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

      it.each([
        `${DELETION} path/to/objects/Account/recordTypes/IT.recordType-meta.xml`,
      ])(
        'should not keep deleted "%s" line matching default ignore pattern',
        line => {
          // Act
          const keep = sut.keep(line)

          // Assert
          expect(keep).toBe(false)
        }
      )
    })
  })
})
