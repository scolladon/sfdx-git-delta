'use strict'
const {
  copyFiles,
  readDir,
  isSubDir,
  readFile,
  scan,
  scanExtension,
} = require('../../../../src/utils/fsHelper')
const { getStreamContent } = require('../../../../src/utils/childProcessUtils')
const { spawn } = require('child_process')
const fs = require('fs')
const { outputFile } = require('fs-extra')
const { EOL } = require('os')

jest.mock('../../../../src/utils/childProcessUtils')
jest.mock('fs')
jest.mock('fs-extra')
jest.mock('child_process')

jest.mock('../../../../src/utils/childProcessUtils', () => {
  const originalModule = jest.requireActual(
    '../../../../src/utils/childProcessUtils'
  )

  //Mock the default export and named export 'foo'
  return {
    ...originalModule,
    getStreamContent: jest.fn(),
  }
})

let work
beforeEach(() => {
  //jest.clearAllMocks()
  work = {
    config: { output: '', source: '', repo: '', generateDelta: false },
    warnings: [],
  }
})

describe('copyFile', () => {
  describe('when file is already copied', () => {
    it('should not copy file', async () => {
      // Arrange
      await copyFiles(work.config, 'source/file', 'output/file')
      jest.resetAllMocks()

      // Act
      await copyFiles(work.config, 'source/file', 'output/file')

      // Assert
      expect(spawn).not.toBeCalled()
      expect(getStreamContent).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is empty', () => {
    it('should not copy file', async () => {
      // Arrange
      getStreamContent.mockImplementation(() => '')

      // Act
      await copyFiles(work.config, 'source/doNotCopy', 'output/doNotCopy')

      // Assert
      expect(spawn).toBeCalled()
      expect(getStreamContent).toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })

  describe('when source location is not empty', () => {
    describe('when content is a folder', () => {
      it('should copy the folder', async () => {
        // Arrange
        getStreamContent.mockImplementationOnce(
          () => 'tree HEAD:folder\n\ncopyFile'
        )
        getStreamContent.mockImplementation(() => 'content')

        // Act
        await copyFiles(work.config, 'source/copyDir', 'output/copyDir')

        // Assert
        expect(spawn).toBeCalledTimes(2)
        expect(getStreamContent).toBeCalledTimes(2)
        expect(outputFile).toBeCalledTimes(1)
      })
    })
    describe('when content is not a git location', () => {
      it('should throw an error', async () => {
        expect.assertions(4)
        // Arrange
        const fatalError = 'fatal: not a git repository'
        getStreamContent.mockImplementation(() => 'fatal: not a git repository')

        // Act
        try {
          await copyFiles(work.config, 'source/warning', 'output/warning')

          // Assert
        } catch (error) {
          expect(spawn).toBeCalled()
          expect(getStreamContent).toBeCalled()
          expect(outputFile).not.toBeCalled()
          expect(error.message).toEqual(fatalError)
        }
      })
    })
    describe('when content is a file', () => {
      beforeEach(async () => {
        // Arrange
        getStreamContent.mockImplementation(() => 'content')
      })
      it('should copy the file', async () => {
        // Act
        await copyFiles(work.config, 'source/copyfile', 'output/copyfile')

        // Assert
        expect(spawn).toBeCalled()
        expect(getStreamContent).toBeCalled()
        expect(outputFile).toBeCalledTimes(1)
      })
    })
  })
})

describe('readDir', () => {
  describe('when getStreamContent succeed', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return the file', async () => {
      // Act
      const dirContent = await readDir(dir, work)

      // Assert
      expect(dirContent).toEqual(expect.arrayContaining([`${dir}${file}`]))
      expect(getStreamContent).toHaveBeenCalled()
    })
  })

  describe('when getStreamContent throw', () => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.reject(new Error('mock'))
      )
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path', work)
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(getStreamContent).toHaveBeenCalled()
      }
    })
  })
})

describe('readFile', () => {
  describe('when readfile succeed', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readFile.mockImplementationOnce(() => Promise.resolve({}))
    })
    it('should return the file', async () => {
      // Act
      const file = await readFile('path')

      // Assert
      expect(file).toBeTruthy()
      expect(fs.promises.readFile).toHaveBeenCalled()
    })
  })

  describe('when readfile throw', () => {
    beforeEach(() => {
      // Arrange
      fs.promises.readFile.mockImplementationOnce(() => Promise.reject('Error'))
    })
    it('should throw', async () => {
      // Act
      try {
        await readFile('path')
      } catch (err) {
        // Assert
        expect(err).toBeTruthy()
        expect(fs.promises.readFile).toHaveBeenCalled()
      }
    })
  })
})
describe('scan', () => {
  describe('when getStreamContent throw', () => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.reject(new Error('mock'))
      )
    })
    it('should throw', async () => {
      // Arrange
      expect.assertions(1)
      const g = scan('dir', work)

      // Assert
      expect(g.next()).rejects.toEqual(new Error('mock'))
    })
  })
  describe('when getStreamContent returns nothing', () => {
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() => Promise.resolve(''))
    })
    it('should return nothing', async () => {
      // Arrange
      const g = scan('dir', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when getStreamContent returns a file', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan(dir, work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toEqual(`${dir}${file}`)
    })
  })
  describe('when getStreamContent returns an empty directory', () => {
    const dir = 'dir/'
    const subDir = 'subDir/'
    it('should return nothing', async () => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve(
          Promise.resolve([`tree HEAD:${dir}`, '', subDir].join(EOL))
        )
      )
      getStreamContent.mockImplementation(() =>
        Promise.resolve([`tree HEAD:${dir}${subDir}`].join(EOL))
      )
      const g = scan('dir', work)

      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })
  describe('when getStreamContent returns a directory with a file', () => {
    const dir = 'dir/'
    const subDir = 'subDir/'
    const subFile = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementationOnce(() =>
        Promise.resolve(
          Promise.resolve([`tree HEAD:${dir}`, '', subDir].join(EOL))
        )
      )
      getStreamContent.mockImplementation(() =>
        Promise.resolve([`tree HEAD:${dir}${subDir}`, '', subFile].join(EOL))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scan('dir', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe(`${dir}${subDir}${subFile}`)
    })
  })
})
describe('scanExtension', () => {
  describe('when directory does not contains a file with the extension', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return', async () => {
      // Arrange
      const g = scanExtension(dir, 'txt', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBeFalsy()
    })
  })

  describe('when directory contains a file with the extension', () => {
    const dir = 'dir/'
    const file = 'test.js'
    beforeEach(() => {
      // Arrange
      getStreamContent.mockImplementation(() =>
        Promise.resolve([`tree HEAD:${dir}`, '', file].join(EOL))
      )
    })
    it('should return a file', async () => {
      // Arrange
      const g = scanExtension(dir, 'js', work)
      // Act
      const result = await g.next()

      // Assert
      expect(result.value).toBe(`${dir}${file}`)
    })
  })
})

describe('isSubDir', () => {
  describe('when parent contains dir', () => {
    it('returns true', async () => {
      // Arrange

      // Act
      const result = isSubDir('parent', 'parent/dir')

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('when parent does not contains dir', () => {
    it('returns false', async () => {
      // Arrange

      // Act
      const result = isSubDir('parent', 'dir/child')

      // Assert
      expect(result).toBe(false)
    })
  })
  it.each([
    ['/foo', '/foo', false],
    ['/foo', '/bar', false],
    ['/foo', '/foobar', false],
    ['/foo', '/foo/bar', true],
    ['/foo', '/foo/../bar', false],
    ['/foo', '/foo/./bar', true],
    ['/bar/../foo', '/foo/bar', true],
    ['/foo', './bar', false],
    ['C:\\Foo', 'C:\\Foo\\Bar', false],
    ['C:\\Foo', 'C:\\Bar', false],
    ['C:\\Foo', 'D:\\Foo\\Bar', false],
  ])(
    `should verify %s expect %s to be a subDir: %s`,
    (parent, child, expected) => {
      // Arrange

      // Act
      const actual = isSubDir(parent, child)

      // Assert
      expect(actual).toBe(expected)
    }
  )
})
